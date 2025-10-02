import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import OrderConfirm from "./pages/OrderConfirm.jsx";
import PartyRegistration from "./pages/PartyRegistration.jsx";
import ProductRegistration from "./pages/ProductRegistration";
import Login from "./pages/Login.jsx";
import FirmRegistration from "./pages/CompanyRegistration.jsx";



function Private({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* You can keep Home protected or make it public—your pick */}
      <Route path="/" element={<Private><Home /></Private>} />
      <Route path="/master/party-registration" element={<PartyRegistration />} />
      <Route path="/master/product-registration" element={<ProductRegistration />} />
      <Route path="/master/company-registration" element={<FirmRegistration />} />
      <Route
        path="/sales/order-confirm"
        element={<Private><OrderConfirm /></Private>}
      />
      {/* default redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
