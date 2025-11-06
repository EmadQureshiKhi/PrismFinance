import { css } from "@emotion/react";
import LogoCarousel from "./LogoCarousel";
import pythLogo from "@/assets/logo_carousel/pyth logo.svg";
import hederaLogo from "@/assets/logo_carousel/hedera logo.svg";
import oracleLogo from "@/assets/logo_carousel/oracle logo.svg";
import reownLogo from "@/assets/logo_carousel/reown logo.svg";

const logos = [
  { src: hederaLogo, alt: "Hedera", width: "250px" },
  { src: pythLogo, alt: "Pyth Network", width: "214px" },
  { src: reownLogo, alt: "Reown", width: "200px" },
  { src: oracleLogo, alt: "Stader", width: "222px" },
];

const PoweredBy = () => {
  return (
    <section
      className="powered-by | content-grid"
      css={css`
        background-color: var(--clr-white);
      `}
    >
      <div
        css={css`
          margin-block: 12rem;
        `}
      >
        <h2
          css={css`
            font-size: 1.25rem;
            line-height: var(--line-height-caption);
            text-align: center;
            color: #696969;
            margin-block-end: var(--size-500);
          `}
        >
          Powered by
        </h2>
        <LogoCarousel logos={logos} />
      </div>
    </section>
  );
};

export default PoweredBy;
