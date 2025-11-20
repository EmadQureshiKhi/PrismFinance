import { css } from "@emotion/react";
import { useState } from "react";
import {
  ArrowsLeftRight,
  Vault,
  ChartLine,
  Coins,
  Users,
  Lightning,
} from "@phosphor-icons/react";

type NavItem = {
  id: string;
  label: string;
  icon: any;
};

const navItems: NavItem[] = [
  { id: "swap", label: "Swap", icon: ArrowsLeftRight },
  { id: "vault", label: "Vault", icon: Vault },
  { id: "assets", label: "Assets", icon: ChartLine },
  { id: "liquidity", label: "Preps", icon: Coins },
  { id: "governance", label: "Governance", icon: Users },
  { id: "earn", label: "Earn", icon: Lightning },
];

interface AppSidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

const AppSidebar = ({ activePage, onPageChange }: AppSidebarProps) => {
  return (
    <aside
      css={css`
        width: 240px;
        background: rgba(10, 14, 39, 0.6);
        border-right: 1px solid rgba(220, 253, 143, 0.1);
        padding: 1.5rem 1rem;
      `}
    >
      <nav>
        <ul
          css={css`
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          `}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isGovernance = item.id === "governance";

            return (
              <li key={item.id}>
                <button
                  onClick={isGovernance ? undefined : () => onPageChange(item.id)}
                  css={css`
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.875rem 1rem;
                    background: ${isActive
                      ? "rgba(220, 253, 143, 0.1)"
                      : "transparent"};
                    border: 1px solid
                      ${isActive
                        ? "rgba(220, 253, 143, 0.3)"
                        : "transparent"};
                    border-radius: 12px;
                    color: ${isActive ? "#dcfd8f" : "#a0a0a0"};
                    font-size: 0.95rem;
                    font-weight: ${isActive ? "600" : "500"};
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;

                    &:hover {
                      background: rgba(220, 253, 143, 0.05);
                      color: #dcfd8f;
                      border-color: rgba(220, 253, 143, 0.2);
                    }
                  `}
                >
                  <Icon size={20} weight={isActive ? "fill" : "regular"} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default AppSidebar;
