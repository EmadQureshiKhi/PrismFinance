import Button from "@/shared/components/ui/button/Button";
import { css } from "@emotion/react";
import { RefObject } from "react";

const LastCTA = ({ ref }: { ref?: RefObject<HTMLElement> }) => {
  return (
    <section
      ref={ref}
      className="last-cta | content-grid"
      css={css`
        background-color: #02302c;
      `}
    >
      <div
        css={css`
          margin-block: 8rem;
        `}
      >
        <div
          css={css`
            display: flex;
            flex-direction: column;
            align-items: center;
          `}
        >
          <h2
            className="heading-5x-large"
            css={css`
              text-align: center;
              color: var(--clr-white);
              margin-block-end: var(--size-600);
            `}
          >
            Connect to global markets, Powered by Hedera.
          </h2>
          <div>
            <Button
              size="large"
              color="primary-light"
              onPress={() => {}}
            >
              Launch App
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LastCTA;
