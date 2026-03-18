import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { NewChatRoute, ExistingChatRoute } from "@/components/chat-route";
import { ProtectedAppLayout } from "./routes/protected-app-layout";
import { LoginPage } from "./pages/login-page";
import { RegisterPage } from "./pages/register-page";

function ChatDetailPage() {
  const { id: chatId } = useParams();

  if (!chatId) {
    return <Navigate replace to="/" />;
  }

  return <ExistingChatRoute chatId={chatId} />;
}

export function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />

      <Route element={<ProtectedAppLayout />}>
        <Route element={<NewChatRoute />} path="/" />
        <Route element={<ChatDetailPage />} path="/chat/:id" />
      </Route>

      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
