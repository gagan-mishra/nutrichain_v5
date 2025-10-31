import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import OrderConfirm from "./pages/OrderConfirm.jsx";
import PartyRegistration from "./pages/PartyRegistration.jsx";
import ProductRegistration from "./pages/ProductRegistration";
import Login from "./pages/Login.jsx";
import FirmRegistration from "./pages/CompanyRegistration.jsx";
import PartyBill from "./pages/PartyBill.jsx";
import BillReceive from "./pages/BillReceive.jsx";
import ReportsParty from "./pages/ReportsParty.jsx";
import ReportsSales from "./pages/ReportsSales.jsx";
import ReportsProduct from "./pages/ReportsProduct.jsx";
import ReportsTransactions from "./pages/ReportsTransactions.jsx";
import Analytics from "./pages/Analytics.jsx";
import Aging from "./pages/Aging.jsx";
import PaymentBehavior from "./pages/PaymentBehavior.jsx";
import Brokerage from "./pages/Brokerage.jsx";
import TopAnalytics from "./pages/TopAnalytics.jsx";
import Cohorts from "./pages/Cohorts.jsx";
import Anomaly from "./pages/Anomaly.jsx";



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
      <Route
        path="/sales/party-bill"
        element={<Private><PartyBill /></Private>}
      />
      <Route
        path="/sales/bill-receive"
        element={<Private><BillReceive /></Private>}
      />
      <Route
        path="/reports/party"
        element={<Private><ReportsParty /></Private>}
      />
      <Route
        path="/reports/sales"
        element={<Private><ReportsSales /></Private>}
      />
      <Route
        path="/reports/product"
        element={<Private><ReportsProduct /></Private>}
      />
      <Route
        path="/reports/transaction"
        element={<Private><ReportsTransactions /></Private>}
      />
      <Route path="/analytics" element={<Private><Analytics /></Private>} />
      <Route path="/analytics/aging" element={<Private><Aging /></Private>} />
      <Route path="/analytics/payment-behavior" element={<Private><PaymentBehavior /></Private>} />
      <Route path="/analytics/brokerage" element={<Private><Brokerage /></Private>} />
      <Route path="/analytics/top" element={<Private><TopAnalytics /></Private>} />
      <Route path="/analytics/cohorts" element={<Private><Cohorts /></Private>} />
      <Route path="/analytics/anomaly" element={<Private><Anomaly /></Private>} />
      {/* default redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
