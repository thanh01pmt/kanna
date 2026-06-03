## 1. Backend Implementation

- [x] 1.1 Thêm command `pi.listSkills` vào backend ws-router để quét các thư mục con trong `~/.pi/agent/skills`.
- [x] 1.2 Thêm command `pi.listMcp` vào backend ws-router để đọc và phân tích file `~/.pi/agent/mcp-cache.json`.
- [x] 1.3 Triển khai helper trên server để mở thư mục cục bộ (dùng lệnh `open` trên macOS) khi nhận yêu cầu từ frontend.

## 2. Frontend Sidebar & Routing

- [x] 2.1 Cập nhật danh sách sidebar items trong `SettingsPage.tsx`: đổi "Providers" sang "Agents", bổ sung tab "LLM" cho Quick Response SDK.
- [x] 2.2 Sửa đổi logic switch-case trong component chính để hỗ trợ render độc lập hai trang `"agents"` và `"llm"`.

## 3. Frontend Agents Config (Accordion)

- [x] 3.1 Xây dựng UI Accordion dọc cho 4 Agent chính (Claude Code, Codex, Antigravity, Pi Agent).
- [x] 3.2 Đồng bộ hóa trạng thái mở accordion mặc định trùng với `defaultProvider` hiện tại.
- [x] 3.3 Hiển thị danh sách Default Tools dưới dạng các badge nhỏ và tích hợp `AgentCliDetectionPill` cho từng Agent trong Accordion.

## 4. Frontend LLM (Quick Response) Config

- [x] 4.1 Di chuyển các inputs cấu hình Quick Response SDK (Base URL, API Key, Model ID) sang tab "LLM".
- [x] 4.2 Bổ sung văn bản giải thích cơ chế Fallback (từ Custom LLM -> Claude Haiku -> Codex GPT-5.4 Mini) dùng cho tác vụ phụ trợ.

## 5. Frontend Context-Aware Skills & MCP

- [x] 5.1 Cập nhật `SkillsSection`: Khi agent hiện tại là Pi Agent, gọi socket `pi.listSkills` để render danh sách custom skills cục bộ của Pi, ẩn form cài đặt của Claude, hiển thị button mở nhanh thư mục `~/.pi/agent/skills`.
- [x] 5.2 Cập nhật `McpSection`: Khi agent hiện tại là Pi Agent, gọi socket `pi.listMcp` để render danh sách các MCP server mà Pi đang cache, ẩn form cấu hình `.mcp.json` của Claude.
- [x] 5.3 Triển khai giao diện thông báo/hướng dẫn tương ứng khi agent hiện tại là Antigravity hoặc Codex.

## 6. Verification & Validation

- [x] 6.1 Tiến hành build thử dự án để kiểm tra lỗi TypeScript/lắp ghép.
- [x] 6.2 Thực hiện xác thực cấu trúc spec: `openspec validate refactor-settings-agent-llm --strict`.
