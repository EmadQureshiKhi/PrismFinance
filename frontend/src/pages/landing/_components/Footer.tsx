import { css } from "@emotion/react";
import { ReactNode, useState } from "react";
import prismLogo from "@/assets/logo/prism-full-logo.png";
import { GithubLogoIcon, XLogoIcon, YoutubeLogoIcon } from "@phosphor-icons/react";
import SupportModal from "./SupportModal";
import ContactModal from "./ContactModal";

interface FooterProps {
  children?: ReactNode;
}
const Footer = ({ children }: FooterProps) => {
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <footer
      className="content-grid"
      css={css`
        background-color: #02302c;
      `}
    >
      <div
        className="footer-inner"
        css={css`
          display: grid;
          grid-auto-rows: auto;
          gap: var(--size-1000);
          border-radius: 1rem;
          padding-inline: var(--size-700);
          padding-block-start: var(--size-700);
          background-color: #dcfd8f;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        `}
      >
        <section
          css={css`
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: var(--size-250);
            height: 12rem;
          `}
        >
          <div
            css={css`
              display: flex;
              flex-direction: column;
              grid-column: 1 / 4;
              align-items: flex-start;
            `}
          >
            <img
              src={prismLogo}
              alt="Prism Finance"
              css={css`
                width: 10rem;
                height: auto;
                max-width: none;
                margin-block-end: var(--size-400);
                margin-block-start: -2.5rem;
              `}
            />
            <nav
              css={css`
                margin-inline-start: 1rem;
                margin-block-start: -1rem;
              `}
            >
              <ul
                css={css`
                  display: flex;
                  gap: var(--size-150);
                `}
              >
                <li>
                  <a
                    href="https://github.com/EmadQureshiKhi/PrismFinance"
                    target="_blank"
                    rel="noopener noreferrer"
                    css={css`
                      display: inline-flex;
                      transition: opacity 0.2s ease;
                      &:hover {
                        opacity: 0.7;
                      }
                    `}
                  >
                    <GithubLogoIcon size={32} color="#02302c" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com/thecorgod1234"
                    target="_blank"
                    rel="noopener noreferrer"
                    css={css`
                      display: inline-flex;
                      transition: opacity 0.2s ease;
                      &:hover {
                        opacity: 0.7;
                      }
                    `}
                  >
                    <XLogoIcon size={32} color="#02302c" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.youtube.com/@emadqureshi4470"
                    target="_blank"
                    rel="noopener noreferrer"
                    css={css`
                      display: inline-flex;
                      transition: opacity 0.2s ease;
                      &:hover {
                        opacity: 0.7;
                      }
                    `}
                  >
                    <YoutubeLogoIcon size={32} color="#02302c" />
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <div
            css={css`
              grid-column: 4 / 13;
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: var(--size-400);
            `}
          >
            <nav>
              <h3
                css={css`
                  font-weight: 700;
                  font-size: var(--fs-large);
                  color: #014a42;
                  margin-block-end: var(--size-300);
                `}
              >
                Info
              </h3>
              <ul
                css={css`
                  display: flex;
                  flex-direction: column;
                  color: #02302c;
                  font-size: var(--fs-medium);
                  line-height: var(--line-height-tight);
                  gap: var(--size-150);
                `}
              >
                <li>Docs & Help</li>
                <li>FAQs</li>
                <li>DEX Tutorials</li>
                <li>Blog</li>
                <li>Brand Assets</li>
              </ul>
            </nav>

            <nav>
              <h3
                css={css`
                  font-weight: 700;
                  font-size: var(--fs-large);
                  color: #014a42;
                  margin-block-end: var(--size-300);
                `}
              >
                Tools
              </h3>
              <ul
                css={css`
                  display: flex;
                  flex-direction: column;
                  color: #02302c;
                  font-size: var(--fs-medium);
                  line-height: var(--line-height-tight);
                  gap: var(--size-150);
                `}
              >
                <li>SDKs & APIs</li>
                <li>HashScan</li>
                <li>Hedera Status</li>
                <li>ChainList</li>
                <li>Github</li>
                <li>Trading View Charts</li>
              </ul>
            </nav>

            <nav>
              <h3
                css={css`
                  font-weight: 700;
                  font-size: var(--fs-large);
                  color: #014a42;
                  margin-block-end: var(--size-300);
                `}
              >
                Participate
              </h3>
              <ul
                css={css`
                  display: flex;
                  flex-direction: column;
                  color: #02302c;
                  font-size: var(--fs-medium);
                  line-height: var(--line-height-tight);
                  gap: var(--size-150);
                `}
              >
                <li>Partnership</li>
                <li>Apply for Listing</li>
                <li>Apply for Farm</li>
                <li>Apply for Prism</li>
                <li>Bug Bounty</li>
                <li>Governance</li>
                <li>Merch</li>
              </ul>
            </nav>

            <nav>
              <h3
                css={css`
                  font-weight: 700;
                  font-size: var(--fs-large);
                  color: #014a42;
                  margin-block-end: var(--size-300);
                `}
              >
                Market
              </h3>
              <ul
                css={css`
                  display: flex;
                  flex-direction: column;
                  color: #02302c;
                  font-size: var(--fs-medium);
                  line-height: var(--line-height-tight);
                  gap: var(--size-150);
                `}
              >
                <li>MEXC Global</li>
                <li>CoinMarketCap</li>
                <li>CoinGecko</li>
                <li>GeckoTerminal</li>
                <li>DexScreener</li>
                <li>DefiLlama</li>
                <li>DappRadar</li>
                <li>Bitget</li>
              </ul>
            </nav>
          </div>
        </section>
        <section
          css={css`
            padding-block: var(--size-300);
          `}
        >
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
            `}
          >
            <p
              css={css`
                color: #02302c;
                font-size: var(--fs-medium);
                line-height: var(--line-height-tight);
              `}
            >
              © {new Date().getFullYear()} Prism Finance. All rights reserved.
            </p>
            <nav>
              <ul
                css={css`
                  display: flex;
                  color: #02302c;
                  font-size: var(--fs-medium);
                  line-height: var(--line-height-tight);
                  gap: var(--size-150);
                `}
              >
                <li>Privacy Policy</li>
                <li>Terms and conditions</li>
                <li>
                  <button
                    onClick={() => setContactModalOpen(true)}
                    css={css`
                      font-size: var(--fs-medium);
                      line-height: var(--line-height-tight);
                      color: #02302c;
                      background: none;
                      border: none;
                      cursor: pointer;
                      padding: 0;
                      &:hover {
                        color: #034a45;
                      }
                      transition: 0.2s color linear;
                    `}
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </section>
      </div>
      <SupportModal
        isOpen={supportModalOpen}
        onOpenChange={setSupportModalOpen}
      />
      <ContactModal
        isOpen={contactModalOpen}
        onOpenChange={setContactModalOpen}
      />
    </footer>
  );
};

export default Footer;
