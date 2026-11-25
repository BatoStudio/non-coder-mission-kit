#!/usr/bin/env node
// Lớp bọc: lỗi bên trong guard-paths thì HỎI, xem run-guarded.mjs. Luật nằm ở guard-paths.impl.mjs.
import { runGuarded } from './run-guarded.mjs';
await runGuarded('guard-paths', () => import('./guard-paths.impl.mjs'));
