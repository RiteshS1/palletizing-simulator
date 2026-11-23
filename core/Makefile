# Plain Makefile: no CMake needed. Every src/*.cpp goes into the engine, every apps/*.cpp
# becomes its own executable in build/bin/, and all tests/*.cpp link into one test runner.

CXX      = clang++
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra -Wpedantic
CPPFLAGS = -Iinclude
BUILD    = build

LIB_SRC  := $(wildcard src/*.cpp)
LIB_OBJ  := $(LIB_SRC:%.cpp=$(BUILD)/%.o)
APP_SRC  := $(wildcard apps/*.cpp)
APPS     := $(APP_SRC:apps/%.cpp=$(BUILD)/bin/%)
TEST_SRC := $(wildcard tests/*.cpp)
TEST_OBJ := $(TEST_SRC:%.cpp=$(BUILD)/%.o)
TEST_BIN := $(BUILD)/bin/run_tests

.PHONY: all test bench run plans wasm clean

all: $(APPS) $(TEST_BIN)

test: $(TEST_BIN)
	./$(TEST_BIN)

bench: $(BUILD)/bin/bench
	./$(BUILD)/bin/bench

# Pack one pallet with each algorithm and write the plans to build/ (inspect or load in the viewer).
run: $(BUILD)/bin/palletize
	./$(BUILD)/bin/palletize --algo greedy --seed 42 --out $(BUILD)/plan_greedy.json
	./$(BUILD)/bin/palletize --algo ep --seed 42 --out $(BUILD)/plan_ep.json

# Compile one .cpp to .o. -MMD -MP also writes a .d file listing the headers it included,
# so editing a header rebuilds exactly the files that depend on it.
$(BUILD)/%.o: %.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -MMD -MP -c $< -o $@

$(BUILD)/bin/%: $(BUILD)/apps/%.o $(LIB_OBJ)
	@mkdir -p $(dir $@)
	$(CXX) $(CXXFLAGS) $^ -o $@

$(TEST_BIN): $(TEST_OBJ) $(LIB_OBJ)
	@mkdir -p $(dir $@)
	$(CXX) $(CXXFLAGS) $^ -o $@

# Plans the web viewer loads (seed 42, 40 boxes), written into web/public/data/.
DATA = ../web/public/data
plans: $(BUILD)/bin/palletize $(BUILD)/bin/wes_sim
	@mkdir -p $(DATA)
	./$(BUILD)/bin/palletize --algo greedy --seed 42 --out $(DATA)/plan_greedy.json
	./$(BUILD)/bin/palletize --algo ep --seed 42 --out $(DATA)/plan_ep.json
	./$(BUILD)/bin/wes_sim --orders 24 --seed 7 --out $(DATA)/wes.json

# The same engine compiled to WebAssembly for the browser (needs Emscripten: em++).
#   -lembind             C++ <-> JS bindings (wasm/bindings.cpp)
#   MODULARIZE+EXPORT_ES6  output is an ES module exporting a factory function
#   ENVIRONMENT=web      no Node.js glue code
#   ALLOW_MEMORY_GROWTH  the heap can grow for big plans
WASM_OUT = ../web/public/wasm
wasm: $(LIB_SRC) wasm/bindings.cpp $(wildcard include/*.hpp)
	@mkdir -p $(WASM_OUT)
	em++ -std=c++17 -O2 $(CPPFLAGS) $(LIB_SRC) wasm/bindings.cpp -lembind \
		-sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web -sALLOW_MEMORY_GROWTH=1 \
		-o $(WASM_OUT)/palletizer.js

clean:
	rm -rf $(BUILD)

-include $(LIB_OBJ:.o=.d) $(TEST_OBJ:.o=.d) $(APP_SRC:apps/%.cpp=$(BUILD)/apps/%.d)
