import { css } from "@emotion/react";
import { useState } from "react";
import Logo from "./Logo";
import Nav from "./Nav";
import NavItem from "./NavItem";
import Button from "@/shared/components/ui/button/Button";
import SupportModal from "./SupportModal";
import ContactModal from "./ContactModal";

const Header = () => {
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <header
      className="content-grid"
      css={css`
        position: absolute;
        inset: 0;
        margin: auto;
        top: -2rem;
        bottom: auto;
        z-index: 10;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        `}
      >
        <div
          css={css`
            margin-inline-start: -2rem;
          `}
        >
          <Logo />
        </div>
        <div
          css={css`
            display: flex;
            align-items: center;
            padding: var(--size-150);
            background-color: var(--clr-white);
            border-radius: var(--border-radius-pill);
            padding-inline-start: var(--size-250);
            font-size: 0.95rem;
          `}
        >
          <Nav>
            <NavItem onClick={() => setSupportModalOpen(true)}>Support</NavItem>
            <NavItem onClick={() => setContactModalOpen(true)}>Contact</NavItem>
          </Nav>
          <div
            css={css`
              margin-inline-start: var(--size-300);
            `}
          >
            <Button onPress={() => window.location.href = '/app'}>Launch App</Button>
          </div>
        </div>
      </div>
      <SupportModal
        isOpen={supportModalOpen}
        onOpenChange={setSupportModalOpen}
      />
      <ContactModal
        isOpen={contactModalOpen}
        onOpenChange={setContactModalOpen}
      />
    </header>
  );
};

export default Header;
