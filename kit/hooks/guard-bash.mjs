#!/usr/bin/env node
// Lớp bọc: lỗi bên trong guard-bash thì HỎI, xem run-guarded.mjs. Luật nằm ở guard-bash.impl.mjs.
import { runGuarded } from './run-guarded.mjs';
await runGuarded('guard-bash', () => import('./guard-bash.impl.mjs'));
