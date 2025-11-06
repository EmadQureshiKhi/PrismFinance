import logo from "@/assets/logo/prism-logo-text.png";
import { css } from "@emotion/react";

const Logo = () => {
  return (
    <h1>
      <img
        src={logo}
        alt="Prism Finance"
        css={css`
          margin-block-end: var(--size-100);
          width: 16rem;
          height: auto;
        `}
      />
    </h1>
  );
};

export default Logo;
