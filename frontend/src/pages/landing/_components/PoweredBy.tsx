import { css } from "@emotion/react";
import LogoCarousel from "./LogoCarousel";
import pythLogo from "@/assets/logo_carousel/pyth logo.svg";
import hederaLogo from "@/assets/logo_carousel/hedera logo.svg";
import oracleLogo from "@/assets/logo_carousel/oracle logo.svg";
import reownLogo from "@/assets/logo_carousel/reown logo.svg";
import chainlinkBlueLogo from "@/assets/logo_carousel/Chainlink-Logo-Blue.svg";
import hederaHashgraphLogo from "@/assets/logo_carousel/Hedera Hashgraph.png";

const originalLogos = [
  { src: hederaLogo, alt: "Hedera", width: "250px" },
  { src: pythLogo, alt: "Pyth Network", width: "214px" },
  { src: reownLogo, alt: "Reown", width: "200px" },
  { src: oracleLogo, alt: "Stader", width: "222px" },
];

const chainlinkLogos = [
  { src: chainlinkBlueLogo, alt: "Chainlink", width: "220px" },
  { src: hederaHashgraphLogo, alt: "Hedera Hashgraph", width: "220px" },
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
        <LogoCarousel logos={originalLogos} />
        <div
          css={css`
            margin-block-start: 3rem;
          `}
        >
          <LogoCarousel logos={chainlinkLogos} />
        </div>
      </div>
    </section>
  );
};

export default PoweredBy;
