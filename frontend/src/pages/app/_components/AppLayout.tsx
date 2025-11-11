import { css } from "@emotion/react";
import { ReactNode } from "react";
import AppHeader from "./AppHeader";

interface AppLayoutProps {
  children: ReactNode;
  onPageChange: (page: string) => void;
}

const AppLayout = ({ children, onPageChange }: AppLayoutProps) => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      `}
    >
      <AppHeader onPageChange={onPageChange} />
      <main
        css={css`
          flex: 1;
          padding: 2rem;
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
        `}
      >
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
