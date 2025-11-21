import { css } from "@emotion/react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AppLayout from "./_components/AppLayout";
import SwapInterface from "./_components/SwapInterface";
import VaultInterface from "./_components/VaultInterface";
import AssetsInterface from "./_components/AssetsInterface";
import PrepsInterface from "./_components/PrepsInterface";
import ReservesPage from "./reserves/ReservesPage";
import { OracleActivator } from "@/components/OracleActivator";
import prismBg from "@/assets/Prism Finance Background Final.png";

const AppPage = () => {
    const location = useLocation();
    
    // Check if we're on the reserves page
    const isReservesPage = location.pathname === "/app/reserves";
    
    // Persist active page in localStorage
    const [activePage, setActivePage] = useState<string>(() => {
        return localStorage.getItem("prism_active_page") || "swap";
    });

    // Save to localStorage whenever page changes
    useEffect(() => {
        if (!isReservesPage) {
            localStorage.setItem("prism_active_page", activePage);
        }
    }, [activePage, isReservesPage]);

    const renderContent = () => {
        // If on reserves page, show reserves
        if (isReservesPage) {
            return <ReservesPage />;
        }
        
        switch (activePage) {
            case "vault":
                return <VaultInterface />;
            case "assets":
                return <AssetsInterface />;
            case "liquidity":
                return <PrepsInterface />;
            case "swap":
            default:
                return <SwapInterface />;
        }
    };

    return (
        <div
            css={css`
                min-height: 100vh;
                position: relative;
                background: #0a0e27 url(${prismBg}) no-repeat center top;
                background-size: cover;
                background-attachment: fixed;

                &::before {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(12, 13, 16, 0.4);
                    pointer-events: none;
                    z-index: 1;
                }
            `}
        >
            <div
                css={css`
                    position: relative;
                    z-index: 2;
                `}
            >
                <AppLayout onPageChange={setActivePage}>
                    {renderContent()}
                </AppLayout>
                
                {/* Oracle Activator - Fixed at bottom right */}
                <div
                    css={css`
                        position: fixed;
                        bottom: 24px;
                        right: 24px;
                        z-index: 1000;
                    `}
                >
                    <OracleActivator />
                </div>
            </div>
        </div>
    );
};

export default AppPage;
