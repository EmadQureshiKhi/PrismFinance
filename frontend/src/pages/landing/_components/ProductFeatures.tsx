import { css } from "@emotion/react";
import ProductFeaturesCarousel from "./ProductFeaturesCarousel";

const ProductFeatures = () => {
  return (
    <section
      className="product-features | content-grid"
      css={css`
        background-color: var(--clr-primary);
      `}
    >
      <div
        css={css`
          height: 100svh;
          background-color: var(--clr-primary);
          align-content: center;
        `}
      >
        <h1
          className="heading-5x-large"
          css={css`
            color: var(--clr-white);
          `}
        >
          Earn yield on global currencies, swap forex instantly, and access tokenized assets.
        </h1>
      </div>
      <ProductFeaturesCarousel />
    </section>
  );
};

export default ProductFeatures;
