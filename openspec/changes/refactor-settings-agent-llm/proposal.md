## Why

Trang Settings hiện tại hiển thị cấu hình của tất cả các Agent cùng lúc (Claude Code, Codex, Antigravity, Pi) và gộp chung Quick Response SDK vào một nơi, gây rối mắt cho người dùng. Ngoài ra, các tab Skills và MCP chỉ tương thích với Claude Code nhưng vẫn hiển thị mặc định cho tất cả các Agent khác, gây hiểu lầm và thiếu trực quan.

## What Changes

- **Giao diện Cài đặt (Settings UI)**:
  - Đổi tên trang/tab "Providers" thành "Agents".
  - Hiển thị danh sách Agent theo dạng Accordion xếp dọc. Mặc định chỉ Accordion của Agent được chọn làm "Default Agent" được mở ra để cấu hình, các Accordion khác sẽ thu gọn.
  - Hiển thị danh sách Default Tools đi kèm của từng Agent bằng các badge/pills trực quan.
  - Tách "Quick Response SDK" thành tab "LLM" riêng biệt để cấu hình các tác vụ phụ trợ phản hồi nhanh (sinh Title, Commit Message) kèm sơ đồ fallback.
- **Cấu hình theo Ngữ cảnh (Context-Aware Skills & MCP)**:
  - Khi người dùng bấm vào tab "Skills" hoặc "MCP", giao diện sẽ tự động thay đổi dựa trên Default Agent đang hoạt động.
  - Nếu Agent là **Claude Code**: Hiển thị đầy đủ chức năng quản lý global skills và `.mcp.json` hiện tại.
  - Nếu Agent là **Pi Agent**:
    - Tab "Skills" sẽ tự động quét và hiển thị danh sách các custom skills cục bộ trong thư mục `~/.pi/agent/skills/` cùng tùy chọn mở nhanh thư mục.
    - Tab "MCP" sẽ tự động quét và hiển thị danh sách các MCP servers cùng tools của Pi từ file cache `~/.pi/agent/mcp-cache.json`.
  - Nếu Agent là **Antigravity** hoặc các Agent khác tự quản lý cục bộ: Hiển thị giao diện thông tin hướng dẫn/quét tương tự.

## Capabilities

### New Capabilities
- `settings-configuration`: Đặc tả các yêu cầu đối với việc hiển thị, phân chia tab cài đặt Agents, LLM, và cơ chế hiển thị Skills/MCP tương thích theo ngữ cảnh của từng Agent.

### Modified Capabilities
- Không có.

## Impact

- **Frontend**:
  - `apps/client/src/client/app/SettingsPage.tsx`: Cập nhật cấu trúc tab, chuyển đổi trang cấu hình Agents và LLM, thêm render accordion, thêm logic render SkillsSection và McpSection tùy biến theo active agent.
- **Backend**:
  - `packages/server/src/ws-router.ts`: Thêm các lệnh socket/RPC mới để quét thư mục `~/.pi/agent/skills/` và đọc file `~/.pi/agent/mcp-cache.json` rồi trả kết quả về frontend.
