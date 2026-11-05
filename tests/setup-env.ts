import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 默认数据库在系统用户数据目录；测试兜底指向一次性临时路径，绝不触碰真实书稿。
// 只设置路径，不创建目录：没有测试打开数据库时不会留下文件。
if (!process.env.YANFIELD_DB_PATH) {
  process.env.YANFIELD_DB_PATH = join(tmpdir(), `yanfield-test-${randomUUID()}`, "test.db");
}
