## 1. Frontend State Management

- [x] 1.1 Thêm state `isValidatingLlm` để theo dõi tiến trình kiểm tra kết nối.
- [x] 1.2 Thêm state `showLlmApiKey` để theo dõi ẩn/hiện API Key.

## 2. Frontend UI Layout Redesign

- [x] 2.1 Cấu trúc lại giao diện tab LLM thành một Form Card có chứa các nhóm trường (Form Groups) với nhãn (Label) rõ ràng.
- [x] 2.2 Tích hợp nút Toggle hiển thị/ẩn API Key sử dụng icon tương ứng.
- [x] 2.3 Bổ sung nút "Test Connection" bên cạnh thông tin trạng thái để kích hoạt kiểm tra kết nối thủ công kèm hiệu ứng loading.

## 3. Verification & Validation

- [x] 3.1 Build thử dự án để kiểm tra lỗi TypeScript.
- [x] 3.2 Xác thực cấu trúc spec: `openspec validate update-llm-tab-layout --strict`.
