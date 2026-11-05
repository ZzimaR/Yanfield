import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultDataDir, resolveDbPath } from "@/lib/db/data-path.mjs";

describe("数据库默认位置", () => {
  it("Windows 使用 %APPDATA%\\Yanfield", () => {
    expect(resolveDbPath({ APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "win32", "C:\\Users\\a")).toBe(
      "C:\\Users\\a\\AppData\\Roaming\\Yanfield\\yanfield.db",
    );
  });

  it("Windows 缺少 APPDATA 时回退到用户目录下的 Roaming", () => {
    expect(defaultDataDir({}, "win32", "C:\\Users\\a")).toBe("C:\\Users\\a\\AppData\\Roaming\\Yanfield");
  });

  it("macOS 使用 Application Support", () => {
    expect(resolveDbPath({}, "darwin", "/Users/a")).toBe("/Users/a/Library/Application Support/Yanfield/yanfield.db");
  });

  it("Linux 遵循 XDG_DATA_HOME，未设置时用 ~/.local/share", () => {
    expect(resolveDbPath({ XDG_DATA_HOME: "/data" }, "linux", "/home/a")).toBe("/data/yanfield/yanfield.db");
    expect(resolveDbPath({}, "linux", "/home/a")).toBe("/home/a/.local/share/yanfield/yanfield.db");
  });

  it("YANFIELD_DB_PATH 优先，相对路径按工作目录解析为绝对路径", () => {
    expect(resolveDbPath({ YANFIELD_DB_PATH: "custom/novels.db" }, "linux", "/home/a")).toBe(
      path.resolve("custom/novels.db"),
    );
    expect(resolveDbPath({ YANFIELD_DB_PATH: "   " }, "linux", "/home/a")).toBe("/home/a/.local/share/yanfield/yanfield.db");
  });
});
