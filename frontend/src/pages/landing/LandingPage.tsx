import Header from "./_components/Header";
import Main from "./_components/Main";
import Footer from "./_components/Footer";
import Hero from "./_components/Hero";
import Mockup from "./_components/Mockup";
import PoweredBy from "./_components/PoweredBy";
import ProductFeatures from "./_components/ProductFeatures";
import Swap from "./_components/Swap";
import LastCTA from "./_components/LastCTA";

const LandingPage = () => {
  return (
    <div className="landing-page" style={{ margin: 0, padding: 0 }}>
      <Header />
      <Main>
        <Hero />
        <Mockup />
        <PoweredBy />
        <ProductFeatures />
        <Swap />
        <LastCTA />
      </Main>
      <Footer />
    </div>
  );
};

export default LandingPage;
