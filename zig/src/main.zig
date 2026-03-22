const std = @import("std");
const json = std.json;
const Allocator = std.mem.Allocator;
const Writer = std.io.Writer;

const allocator = std.heap.wasm_allocator;

var result_data: ?[]u8 = null;

export fn alloc(len: usize) ?[*]u8 {
    const slice = allocator.alloc(u8, len) catch return null;
    return slice.ptr;
}

export fn dealloc(ptr: [*]u8, len: usize) void {
    allocator.free(ptr[0..len]);
}

export fn getResultPtr() ?[*]const u8 {
    if (result_data) |d| return d.ptr;
    return null;
}

export fn getResultLen() usize {
    if (result_data) |d| return d.len;
    return 0;
}

export fn freeResult() void {
    if (result_data) |d| {
        allocator.free(d);
        result_data = null;
    }
}

export fn diff(a_ptr: [*]const u8, a_len: usize, b_ptr: [*]const u8, b_len: usize) i32 {
    const a_slice = a_ptr[0..a_len];
    const b_slice = b_ptr[0..b_len];

    const a_parsed = json.parseFromSlice(json.Value, allocator, a_slice, .{}) catch return -1;
    defer a_parsed.deinit();

    const b_parsed = json.parseFromSlice(json.Value, allocator, b_slice, .{}) catch return -1;
    defer b_parsed.deinit();

    var aw: Writer.Allocating = .init(allocator);
    errdefer aw.deinit();

    var jw: json.Stringify = .{ .writer = &aw.writer };

    jw.beginArray() catch return -1;
    var path: PathBuf = .{};
    diffValues(&jw, a_parsed.value, b_parsed.value, &path) catch return -1;
    jw.endArray() catch return -1;

    aw.writer.flush() catch return -1;
    const slice = aw.toOwnedSlice() catch return -1;
    result_data = slice;
    return @intCast(slice.len);
}

const PathBuf = struct {
    segments: [64]PathSegment = undefined,
    len: usize = 0,

    fn push(self: *PathBuf, seg: PathSegment) void {
        if (self.len < 64) {
            self.segments[self.len] = seg;
            self.len += 1;
        }
    }

    fn pop(self: *PathBuf) void {
        if (self.len > 0) self.len -= 1;
    }

    fn slice(self: *const PathBuf) []const PathSegment {
        return self.segments[0..self.len];
    }
};

const PathSegment = union(enum) {
    key: []const u8,
    index: usize,
};

fn writePath(jw: *json.Stringify, path: []const PathSegment) !void {
    try jw.beginArray();
    for (path) |seg| {
        switch (seg) {
            .key => |k| try jw.write(k),
            .index => |i| try jw.write(i),
        }
    }
    try jw.endArray();
}

fn writeOp(jw: *json.Stringify, op: []const u8, path: []const PathSegment, val: json.Value) !void {
    try jw.beginObject();
    try jw.objectField("op");
    try jw.write(op);
    try jw.objectField("path");
    try writePath(jw, path);
    try jw.objectField("value");
    try jw.write(val);
    try jw.endObject();
}

fn writeReplace(jw: *json.Stringify, path: []const PathSegment, old: json.Value, new: json.Value) !void {
    try jw.beginObject();
    try jw.objectField("op");
    try jw.write("replace");
    try jw.objectField("path");
    try writePath(jw, path);
    try jw.objectField("old");
    try jw.write(old);
    try jw.objectField("new");
    try jw.write(new);
    try jw.endObject();
}

fn diffValues(jw: *json.Stringify, a: json.Value, b: json.Value, path: *PathBuf) !void {
    if (valuesEqual(a, b)) return;

    const a_tag: u8 = @intFromEnum(a);
    const b_tag: u8 = @intFromEnum(b);

    if (a_tag != b_tag) {
        try writeReplace(jw, path.slice(), a, b);
        return;
    }

    switch (a) {
        .object => |a_obj| {
            const b_obj = b.object;

            var a_it = a_obj.iterator();
            while (a_it.next()) |entry| {
                path.push(.{ .key = entry.key_ptr.* });
                if (b_obj.get(entry.key_ptr.*)) |b_val| {
                    try diffValues(jw, entry.value_ptr.*, b_val, path);
                } else {
                    try writeOp(jw, "remove", path.slice(), entry.value_ptr.*);
                }
                path.pop();
            }

            var b_it = b_obj.iterator();
            while (b_it.next()) |entry| {
                if (!a_obj.contains(entry.key_ptr.*)) {
                    path.push(.{ .key = entry.key_ptr.* });
                    try writeOp(jw, "add", path.slice(), entry.value_ptr.*);
                    path.pop();
                }
            }
        },
        .array => |a_arr| {
            const b_arr = b.array;
            const max = @max(a_arr.items.len, b_arr.items.len);
            for (0..max) |i| {
                path.push(.{ .index = i });
                if (i >= a_arr.items.len) {
                    try writeOp(jw, "add", path.slice(), b_arr.items[i]);
                } else if (i >= b_arr.items.len) {
                    try writeOp(jw, "remove", path.slice(), a_arr.items[i]);
                } else {
                    try diffValues(jw, a_arr.items[i], b_arr.items[i], path);
                }
                path.pop();
            }
        },
        else => {
            try writeReplace(jw, path.slice(), a, b);
        },
    }
}

fn valuesEqual(a: json.Value, b: json.Value) bool {
    const a_tag: u8 = @intFromEnum(a);
    const b_tag: u8 = @intFromEnum(b);
    if (a_tag != b_tag) return false;

    return switch (a) {
        .null => true,
        .bool => a.bool == b.bool,
        .integer => a.integer == b.integer,
        .float => a.float == b.float,
        .string => std.mem.eql(u8, a.string, b.string),
        .number_string => std.mem.eql(u8, a.number_string, b.number_string),
        .array => |a_arr| {
            const b_arr = b.array;
            if (a_arr.items.len != b_arr.items.len) return false;
            for (a_arr.items, b_arr.items) |ai, bi| {
                if (!valuesEqual(ai, bi)) return false;
            }
            return true;
        },
        .object => |a_obj| {
            const b_obj = b.object;
            if (a_obj.count() != b_obj.count()) return false;
            var it = a_obj.iterator();
            while (it.next()) |entry| {
                if (b_obj.get(entry.key_ptr.*)) |bv| {
                    if (!valuesEqual(entry.value_ptr.*, bv)) return false;
                } else return false;
            }
            return true;
        },
    };
}
