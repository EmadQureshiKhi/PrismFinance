import { css } from "@emotion/react";
import AppLayout from "./_components/AppLayout";
import SwapInterface from "./_components/SwapInterface";
import prismBg from "@/assets/Prism Finance Background Final.png";

const AppPage = () => {
    return (
        <div
            css={css`
                min-height: 100vh;
                position: relative;
                background: #0a0e27 url(${prismBg}) no-repeat center center;
                background-size: cover;

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
                <AppLayout>
                    <SwapInterface />
                </AppLayout>
            </div>
        </div>
    );
};

export default AppPage;
