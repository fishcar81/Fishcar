# C++ 提示搜索器

`golden_solver.cpp` 是《黄金替罪芙》的 C++ 加权 A* 提示模块。浏览器通过 WebAssembly 调用它；每次提示的搜索预算固定为 **400ms**。

- 在时限内找到完整路线：返回 `FOUND` 和该路线第一步。
- 时限到达仍未完成：返回 `BEST` 和目前搜索树中进度最高、启发代价最低的第一步。
- 不会自动移动角色。

在 Windows 上运行 `build-wasm.bat` 生成 `golden-solver.js` 与 `golden-solver.wasm`。
