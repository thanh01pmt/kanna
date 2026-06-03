## Context

Kanna hiện tại tích hợp cấu hình Agent (Claude Code, Codex, Antigravity, Pi) và Quick Response SDK (LLM) vào chung một trang "Providers" trong Settings UI. Ngoài ra, cấu hình Skills và MCP của Kanna hiện chỉ có hiệu lực với Claude Code, nhưng vẫn được hiển thị chung cho mọi Agent mà không có sự chọn lọc hay hướng dẫn. 
Việc cải tổ này nhằm phân tách rõ ràng cấu trúc cấu hình và mang lại trải nghiệm context-aware (tự thích ứng theo Agent được chọn) cho người dùng.

## Goals / Non-Goals

**Goals:**
- Tách trang "Providers" thành hai trang riêng biệt: "Agents" và "LLM" (cho Quick Response SDK).
- Cấu hình Agents được sắp xếp dưới dạng Accordion xếp dọc. Chỉ Accordion của Default Agent được chọn là mở rộng mặc định.
- Hiển thị danh sách công cụ mặc định (Default Tools) đi kèm của từng Agent bằng các badge/pills trực quan.
- Tự động thay đổi nội dung hiển thị ở các tab "Skills" và "MCP" dựa trên Default Agent hiện tại.
- Quét và hiển thị động danh sách các custom skills cục bộ của Pi (từ thư mục `~/.pi/agent/skills`) và danh sách MCP servers của Pi (từ file cache `~/.pi/agent/mcp-cache.json`).

**Non-Goals:**
- Thay đổi runtime thực thi chính của các Agent (Pi, Antigravity, Codex, Claude Code).
- Cho phép chỉnh sửa cấu hình MCP hoặc Skills của Pi Agent trực tiếp từ Kanna UI (chỉ hỗ trợ quét, hiển thị thông tin và cung cấp phím tắt mở thư mục cục bộ).

## Decisions

### 1. Phân chia cấu trúc Sidebar Items trong Settings UI
- Sửa đổi menu sidebar của Settings:
  - Thay thế item `id: "providers"` thành `id: "agents"` với nhãn là `"Agents"`.
  - Thêm một item mới `id: "llm"` với nhãn là `"LLM (Quick Response)"` ngay dưới tab Agents.
- Sửa đổi routing nội bộ trong component `SettingsPage.tsx` tương ứng với hai `selectedPage` mới.

### 2. Thiết kế Accordion cấu hình Agent mặc định
- Triển khai một cơ chế accordion dọc đơn giản bằng TailwindCSS và state cục bộ `expandedAgentId`.
- Mặc định khi mount trang Settings, `expandedAgentId` sẽ được gán bằng `defaultProvider` (lấy từ preferences store).
- Trong mỗi accordion của Agent, hiển thị:
  - Cấu hình Defaults (Model, Reasoning Effort, Plan Mode...) thông qua `ChatPreferenceControls` (giống như cũ nhưng được cô lập cho từng Agent).
  - Danh sách Default Tools của Agent đó bằng các Badge/Pill nhỏ màu xám.
  - Trạng thái cài đặt CLI của Agent trên máy (qua `AgentCliDetectionPill`).

### 3. Tách biệt Cấu hình LLM (Quick Response SDK)
- Di chuyển toàn bộ giao diện cấu hình Quick Response SDK (Select provider, Inputs Base URL, API Key, Model ID) sang tab `"llm"` mới.
- Bổ sung ghi chú và sơ đồ giải thích cơ chế Fallback của các tác vụ phụ trợ (sinh title/commit) để làm rõ vai trò của LLM này so với các Agent chính.

### 4. API Backend quét MCP/Skills của Pi Agent
- **MCP Command (`pi.listMcp`)**:
  - Đọc file `~/.pi/agent/mcp-cache.json` nếu tồn tại.
  - Phân tích cú pháp và trả về cấu trúc gồm danh sách các server kèm theo các công cụ (tools) của từng server.
- **Skills Command (`pi.listSkills`)**:
  - Đọc danh sách thư mục con trong `~/.pi/agent/skills/`.
  - Trả về danh sách tên các skill (tên thư mục) cho frontend hiển thị.
- Các API này được khai báo và xử lý trong `packages/server/src/ws-router.ts`.

### 5. Giao diện Context-Aware tại tab Skills và MCP
- Component `SkillsSection` và `McpSection` trong `SettingsPage.tsx` sẽ đọc `defaultProvider` từ preferences store.
- **Tại `SkillsSection`**:
  - Nếu `defaultProvider === "claude"`: Render giao diện quản lý global skills qua `skills.sh` hiện tại.
  - Nếu `defaultProvider === "pi"`: Gửi lệnh socket `pi.listSkills` để lấy các skills cục bộ và hiển thị thành danh sách các cards, kèm một button "Open Folder" để mở thư mục `~/.pi/agent/skills` trong Finder/VSCode.
  - Nếu `defaultProvider === "antigravity"`: Render banner thông báo và hướng dẫn tương tự.
- **Tại `McpSection`**:
  - Nếu `defaultProvider === "claude"`: Render cấu hình `.mcp.json` và toggle tools hiện tại.
  - Nếu `defaultProvider === "pi"`: Gửi lệnh socket `pi.listMcp` để lấy các MCP servers đang cache của Pi và render danh sách chi tiết (read-only), kèm banner giải thích.
  - Nếu `defaultProvider === "antigravity"`: Render banner thông báo.

## Risks / Trade-offs

- **[Risk] Path không chính xác trên các hệ điều hành khác nhau**
  - *Mitigation:* Thư mục mặc định của Pi `~/.pi/agent` sẽ được phân giải động trên OS (dùng `os.homedir()` ở Node.js backend) để đảm bảo đường dẫn tuyệt đối chính xác trên cả macOS và Linux.
- **[Risk] File mcp-cache.json hoặc folder skills của Pi không tồn tại**
  - *Mitigation:* Phía backend sẽ kiểm tra sự tồn tại (fs.existsSync) trước khi đọc. Nếu không tồn tại, trả về danh sách rỗng thay vì ném lỗi (crash server).
