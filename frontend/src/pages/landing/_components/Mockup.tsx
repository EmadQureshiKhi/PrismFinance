import { css } from "@emotion/react";

import mockup from "@/assets/mockups/home_mockup.png";
import MockupNotification from "./MockupNotification";
import {
  ArrowLineDownIcon,
  ArrowsLeftRight,
  ArrowsLeftRightIcon,
  MoneyIcon,
  PaperPlaneRightIcon,
} from "@phosphor-icons/react";

const Mockup = () => {
  return (
    <section
      className="mockup | content-grid"
      css={css`
        background-color: var(--clr-white);
        position: relative;
      `}
    >
      <div
        className="full-width"
        css={css`
          margin-block-start: -10rem;
        `}
      >
        <div
          className="mockup-container"
          css={css`
            position: relative;
            width: 350px;
            height: auto;
            margin-inline: auto;
          `}
        >
          <img
            src={mockup}
            alt=""
            css={css`
              margin-inline: auto;
              width: 350px;
              height: auto;
              border: 3px solid #02302c;
              border-radius: 1.5rem;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            `}
          />
          <MockupNotification
            icon={ArrowsLeftRightIcon}
            title="Swapped"
            subtitle="100 pUSD → 92 pEUR"
            inset="5rem -80% auto auto"
          />
          <MockupNotification
            icon={MoneyIcon}
            title="Earned Yield"
            subtitle="+12% APY on pUSD"
            inset="auto auto 8rem -92%"
          />
          <MockupNotification
            icon={ArrowLineDownIcon}
            title="Bought Asset"
            subtitle="0.4 pTSLA ($100)"
            inset="0 auto 10rem -80%"
          />
          <MockupNotification
            icon={PaperPlaneRightIcon}
            title="Deposited"
            subtitle="1000 HBAR → pUSD"
            inset="10rem -100% 0 auto"
          />
        </div>
      </div>
    </section>
  );
};

export default Mockup;
