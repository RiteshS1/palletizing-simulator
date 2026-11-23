#pragma once
// A minimal JSON writer (no dependencies).
//
//   JsonWriter j;
//   j.beginObject().key("n").value(3).key("xs").beginArray().value(1).value(2).endArray().endObject();
//   j.str()  ->  {"n":3,"xs":[1,2]}
//
// The only tricky part of writing JSON is commas: every value except the first in a container
// needs one. We keep a STACK with one flag per open container ("has it had an element yet?"),
// because containers nest: push on begin, pop on end.

#include <cmath>
#include <cstdio>
#include <string>
#include <type_traits>
#include <vector>

namespace pal {

class JsonWriter {
public:
    JsonWriter& beginObject() { open('{'); return *this; }
    JsonWriter& endObject() { close('}'); return *this; }
    JsonWriter& beginArray() { open('['); return *this; }
    JsonWriter& endArray() { close(']'); return *this; }

    JsonWriter& key(const std::string& k) {
        separator();
        writeString(k);
        out_ += ':';
        afterKey_ = true;  // the value that follows must not get its own comma
        return *this;
    }

    // One template for every integer type (int, int64_t, size_t, ...). Plain overloads for
    // int / long long / double would be ambiguous for some of them.
    template <typename T, std::enable_if_t<std::is_integral_v<T> && !std::is_same_v<T, bool>, int> = 0>
    JsonWriter& value(T v) {
        separator();
        out_ += std::to_string(v);
        return *this;
    }
    JsonWriter& value(double v) {
        separator();
        if (!std::isfinite(v)) { out_ += "null"; return *this; }  // JSON has no NaN/Infinity
        char buf[32];
        std::snprintf(buf, sizeof buf, "%.10g", v);
        out_ += buf;
        return *this;
    }
    JsonWriter& value(bool v) { separator(); out_ += v ? "true" : "false"; return *this; }
    JsonWriter& value(const std::string& v) { separator(); writeString(v); return *this; }
    JsonWriter& value(const char* v) { return value(std::string(v)); }

    const std::string& str() const { return out_; }

private:
    void open(char c) { separator(); out_ += c; hasElement_.push_back(false); }
    void close(char c) { hasElement_.pop_back(); out_ += c; }

    void separator() {
        if (afterKey_) { afterKey_ = false; return; }
        if (!hasElement_.empty()) {
            if (hasElement_.back()) out_ += ',';
            hasElement_.back() = true;
        }
    }

    void writeString(const std::string& s) {
        out_ += '"';
        for (char c : s) {
            if (c == '"' || c == '\\') { out_ += '\\'; out_ += c; }
            else if (c == '\n') out_ += "\\n";
            else out_ += c;
        }
        out_ += '"';
    }

    std::string out_;
    std::vector<bool> hasElement_;  // the stack
    bool afterKey_ = false;
};

}  // namespace pal
