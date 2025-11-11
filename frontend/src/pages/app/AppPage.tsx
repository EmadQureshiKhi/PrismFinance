import { css } from "@emotion/react";
import { useState, useEffect } from "react";
import AppLayout from "./_components/AppLayout";
import SwapInterface from "./_components/SwapInterface";
import VaultInterface from "./_components/VaultInterface";
import prismBg from "@/assets/Prism Finance Background Final.png";

const AppPage = () => {
    // Persist active page in localStorage
    const [activePage, setActivePage] = useState<string>(() => {
        return localStorage.getItem("prism_active_page") || "swap";
    });

    // Save to localStorage whenever page changes
    useEffect(() => {
        localStorage.setItem("prism_active_page", activePage);
    }, [activePage]);

    const renderContent = () => {
        switch (activePage) {
            case "vault":
                return <VaultInterface />;
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
            </div>
        </div>
    );
};

export default AppPage;
