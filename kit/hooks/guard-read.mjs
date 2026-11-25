#!/usr/bin/env node
// Lớp bọc: lỗi bên trong guard-read thì HỎI, xem run-guarded.mjs. Luật nằm ở guard-read.impl.mjs.
import { runGuarded } from './run-guarded.mjs';
await runGuarded('guard-read', () => import('./guard-read.impl.mjs'));
