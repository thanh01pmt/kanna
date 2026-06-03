# Change: Update LLM Tab Layout

## Why
Giao diện tab cài đặt LLM hiện tại hiển thị các ô nhập (Base URL, API Key, Model ID) liền kề nhau mà không có nhãn (label) rõ ràng, gây khó khăn cho việc nhận biết và cấu hình. Đồng thời, hành động validation diễn ra tự động trên blur mà không có phản hồi trực quan khi đang kết nối, và thiếu tính năng ẩn/hiện API Key cũng như nút kiểm tra kết nối thủ công.

## What Changes
- **Credential Layout**: Gom các inputs cấu hình vào một card container hiện đại, thêm các nhãn tiêu đề (Provider, Base URL, API Key, Model ID) và mô tả ngắn cho từng trường.
- **Show/Hide API Key**: Thêm nút ẩn/hiện API Key để người dùng dễ kiểm tra và quản lý.
- **Manual Test Connection**: Thêm nút "Test Connection" thủ công để kích hoạt validation, hiển thị trạng thái đang kiểm tra kết nối để tăng trải nghiệm trực quan.

## Impact
- Specs: `specs/settings-configuration/spec.md`
- Code: `apps/client/src/client/app/SettingsPage.tsx`
