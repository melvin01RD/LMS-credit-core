"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function UnauthorizedPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  return (
    <div className={`container ${visible ? "visible" : ""}`}>
      <div className="card">
        <div className="icon-wrap">
          <div className="shield">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M32 4L8 14v18c0 13.3 10.3 25.7 24 29 13.7-3.3 24-15.7 24-29V14L32 4z"
                fill="url(#shieldGrad)"
                stroke="#6B21E8"
                strokeWidth="1.5"
              />
              <path
                d="M22 32l7 7 13-13"
                stroke="none"
              />
              <line x1="24" y1="24" x2="40" y2="40" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <line x1="40" y1="24" x2="24" y2="40" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <defs>
                <linearGradient id="shieldGrad" x1="8" y1="4" x2="56" y2="62" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#1B1F6B" />
                  <stop offset="1" stopColor="#6B21E8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="pulse-ring" />
          <div className="pulse-ring delay" />
        </div>

        <div className="code">403</div>
        <h1 className="title">Acceso Restringido</h1>
        <p className="subtitle">
          No tienes permisos para acceder a esta sección del sistema.
        </p>

        <div className="divider" />

        <div className="info-box">
          <svg className="info-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="info-text">
            Si necesitas acceso a esta área, comunícate con tu{" "}
            <strong>administrador del sistema</strong> para solicitar los permisos correspondientes.
          </p>
        </div>

        <button className="btn" onClick={() => router.push("/dashboard")}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Volver al Dashboard
        </button>
      </div>

      <style jsx>{`
        .container {
          min-height: 100vh;
          background: #0f1035;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
          position: relative;
          overflow: hidden;
        }
        .container::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(107, 33, 232, 0.12) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 80% 80%, rgba(27, 31, 107, 0.3) 0%, transparent 70%);
          pointer-events: none;
        }
        .container.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(107, 33, 232, 0.25);
          border-radius: 20px;
          padding: 3rem 2.5rem;
          max-width: 460px;
          width: 100%;
          text-align: center;
          backdrop-filter: blur(12px);
          box-shadow:
            0 0 0 1px rgba(107, 33, 232, 0.1),
            0 32px 64px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255,255,255,0.06);
          position: relative;
          z-index: 1;
        }
        .icon-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }
        .shield {
          width: 72px;
          height: 72px;
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 0 16px rgba(107, 33, 232, 0.5));
        }
        .pulse-ring {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 1.5px solid rgba(107, 33, 232, 0.3);
          animation: pulse 2.5s ease-out infinite;
        }
        .pulse-ring.delay {
          animation-delay: 1.25s;
        }
        @keyframes pulse {
          0% { transform: scale(0.85); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .code {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: #6B21E8;
          text-transform: uppercase;
          margin-bottom: 0.75rem;
        }
        .title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 0.75rem;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .subtitle {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.55);
          margin: 0;
          line-height: 1.6;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(107, 33, 232, 0.3), transparent);
          margin: 1.75rem 0;
        }
        .info-box {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          background: rgba(107, 33, 232, 0.08);
          border: 1px solid rgba(107, 33, 232, 0.2);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          text-align: left;
          margin-bottom: 1.75rem;
        }
        .info-icon {
          width: 18px;
          height: 18px;
          color: #6B21E8;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .info-text {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          line-height: 1.6;
        }
        .info-text strong {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #1B1F6B, #6B21E8);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 0.75rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 16px rgba(107, 33, 232, 0.3);
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(107, 33, 232, 0.45);
          filter: brightness(1.1);
        }
        .btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
