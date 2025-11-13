import { css } from "@emotion/react";
import { useReserves } from "@/hooks/useReserves";
import { ArrowClockwise, Warning, DownloadSimple, Link } from "@phosphor-icons/react";
import { CONTRACTS } from "@/config/contracts";

const ReservesPage = () => {
    const { reserveData, attestations, isLoading, error, lastRefresh, refresh } = useReserves();

    const getHealthColor = (status: string) => {
        switch (status) {
            case "HEALTHY": return "#dcfd8f";
            case "WARNING": return "#ffd700";
            case "CRITICAL": return "#ff6b6b";
            default: return "#dcfd8f";
        }
    };

    const downloadAuditReport = () => {
        if (!reserveData) return;

        const report = {
            generatedAt: new Date().toISOString(),
            lastRefresh: lastRefresh?.toISOString(),
            reserves: {
                totalCollateral: reserveData.totalCollateral,
                totalDebt: reserveData.totalDebt,
                collateralRatio: reserveData.collateralRatio,
                healthStatus: reserveData.healthStatus,
                contractBalance: reserveData.contractBalance,
                totalUsers: reserveData.totalUsers
            },
            attestations: attestations,
            metadata: {
                network: "Hedera Testnet",
                hcsTopic: CONTRACTS.hcsTopic,
                contracts: {
                    vault: CONTRACTS.vault,
                    reserveOracle: CONTRACTS.oracle
                }
            }
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prism-reserves-audit-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isLoading && !reserveData) {
        return (
            <div css={css`
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 400px;
        color: #ffffff;
        gap: 1rem;
      `}>
                <div css={css`
          width: 40px;
          height: 40px;
          border: 3px solid rgba(220, 253, 143, 0.3);
          border-top: 3px solid #dcfd8f;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `} />
                <div css={css`
          font-size: 1.125rem;
          color: #a0a0a0;
        `}>
                    Loading reserves data...
                </div>
            </div>
        );
    }

    if (error && !reserveData) {
        return (
            <div css={css`
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 400px;
        color: #ffffff;
        gap: 1rem;
      `}>
                <Warning size={48} weight="bold" css={css`color: #ff6b6b;`} />
                <div css={css`
          font-size: 1.125rem;
          color: #ff6b6b;
          text-align: center;
          max-width: 400px;
        `}>
                    {error}
                </div>
                <button
                    onClick={refresh}
                    css={css`
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            
            &:hover {
              background: rgba(255, 255, 255, 0.15);
            }
          `}
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div css={css`
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      color: #ffffff;
    `}>
            {/* Header */}
            <div css={css`
        text-align: center;
        margin-bottom: 3rem;
      `}>
                <h1 css={css`
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #dcfd8f 0%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        `}>
                    Proof of Reserves
                </h1>
                <p css={css`
          font-size: 1.125rem;
          color: #a0a0a0;
          max-width: 600px;
          margin: 0 auto;
          margin-bottom: 1rem;
        `}>
                    Real-time transparency into Prism Finance's collateral backing and reserve health
                </p>

                {/* Last Refresh & Refresh Button */}
                <div css={css`
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1rem;
        `}>
                    {lastRefresh && (
                        <div css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
            `}>
                            Last updated: {lastRefresh.toLocaleTimeString()}
                        </div>
                    )}

                    <button
                        onClick={refresh}
                        disabled={isLoading}
                        css={css`
              background: rgba(255, 255, 255, 0.1);
              color: #ffffff;
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 8px;
              padding: 0.5rem 0.75rem;
              cursor: ${isLoading ? 'not-allowed' : 'pointer'};
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.875rem;
              opacity: ${isLoading ? 0.6 : 1};
              
              &:hover {
                background: ${isLoading ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.15)'};
              }
            `}
                    >
                        <ArrowClockwise
                            size={16}
                            weight="bold"
                            css={css`
                animation: ${isLoading ? 'spin 1s linear infinite' : 'none'};
                
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
                        />
                        Refresh
                    </button>
                </div>

                {error && (
                    <div css={css`
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            color: #ff6b6b;
            font-size: 0.875rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            max-width: 600px;
            margin: 0 auto;
          `}>
                        <Warning size={16} weight="bold" />
                        {error}
                    </div>
                )}
            </div>

            {/* Reserve Stats */}
            <div css={css`
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
        margin-bottom: 3rem;
        
        @media (max-width: 1024px) {
          grid-template-columns: 1fr;
        }
      `}>
                {/* Total Collateral */}
                <div css={css`
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        `}>
                    {isLoading && (
                        <div css={css`
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(90deg, transparent, #dcfd8f, transparent);
              animation: shimmer 1.5s infinite;
              
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `} />
                    )}
                    <div css={css`
            font-size: 0.875rem;
            color: #a0a0a0;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          `}>
                        Total Collateral
                    </div>
                    <div css={css`
            font-size: 2.5rem;
            font-weight: 700;
            color: #dcfd8f;
            margin-bottom: 0.25rem;
          `}>
                        {reserveData?.totalCollateral || "0.00"}
                    </div>
                    <div css={css`
            font-size: 0.875rem;
            color: #a0a0a0;
          `}>
                        HBAR
                    </div>
                </div>

                {/* Total Debt */}
                <div css={css`
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        `}>
                    {isLoading && (
                        <div css={css`
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(90deg, transparent, #dcfd8f, transparent);
              animation: shimmer 1.5s infinite;
              animation-delay: 0.2s;
              
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `} />
                    )}
                    <div css={css`
            font-size: 0.875rem;
            color: #a0a0a0;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          `}>
                        Total Debt
                    </div>
                    <div css={css`
            font-size: 2.5rem;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 0.25rem;
          `}>
                        {reserveData?.totalDebt || "0.00"}
                    </div>
                    <div css={css`
            font-size: 0.875rem;
            color: #a0a0a0;
          `}>
                        USD Value
                    </div>
                </div>

                {/* Collateral Ratio */}
                <div css={css`
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        `}>
                    {isLoading && (
                        <div css={css`
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(90deg, transparent, #dcfd8f, transparent);
              animation: shimmer 1.5s infinite;
              animation-delay: 0.4s;
              
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `} />
                    )}
                    <div css={css`
            font-size: 0.875rem;
            color: #a0a0a0;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          `}>
                        Collateral Ratio
                    </div>
                    <div css={css`
            font-size: 2.5rem;
            font-weight: 700;
            color: ${getHealthColor(reserveData?.healthStatus || "HEALTHY")};
            margin-bottom: 0.25rem;
          `}>
                        {reserveData?.collateralRatio || "∞"}%
                    </div>
                    <div css={css`
            font-size: 0.875rem;
            color: ${getHealthColor(reserveData?.healthStatus || "HEALTHY")};
            font-weight: 600;
          `}>
                        {reserveData?.healthStatus || "HEALTHY"}
                    </div>
                </div>

            </div>

            {/* Actions */}
            <div css={css`
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-bottom: 3rem;
      `}>
                <button
                    onClick={downloadAuditReport}
                    css={css`
            background: linear-gradient(135deg, #dcfd8f 0%, #b8e86b 100%);
            color: #000000;
            border: none;
            border-radius: 12px;
            padding: 0.875rem 1.5rem;
            font-weight: 600;
            font-size: 0.9375rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            
            &:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(220, 253, 143, 0.3);
            }
          `}
                >
                    <DownloadSimple size={20} weight="bold" />
                    Download Audit Report
                </button>

                <a
                    href={`https://hashscan.io/${CONTRACTS.network}/topic/${CONTRACTS.hcsTopic}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    css={css`
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 0.875rem 1.5rem;
            font-weight: 600;
            font-size: 0.9375rem;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            
            &:hover {
              background: rgba(255, 255, 255, 0.15);
              transform: translateY(-2px);
            }
          `}
                >
                    <Link size={20} weight="bold" />
                    View HCS Topic
                </a>
            </div>

            {/* Attestation History */}
            <div css={css`
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 2rem;
      `}>
                <h2 css={css`
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          color: #ffffff;
        `}>
                    Recent Attestations
                </h2>

                <div css={css`
          overflow-x: auto;
        `}>
                    <table css={css`
            width: 100%;
            border-collapse: collapse;
            
            th, td {
              text-align: left;
              padding: 1rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
            
            th {
              font-weight: 600;
              color: #a0a0a0;
              font-size: 0.875rem;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            td {
              color: #ffffff;
              font-size: 0.9375rem;
            }
          `}>
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Collateral</th>
                                <th>Debt</th>
                                <th>Ratio</th>
                                <th>Transaction</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attestations.length > 0 ? (
                                attestations.map((attestation, index) => (
                                    <tr key={index}>
                                        <td>
                                            {new Date(attestation.timestamp).toLocaleString()}
                                        </td>
                                        <td css={css`color: #dcfd8f; font-weight: 600;`}>
                                            {attestation.collateral} HBAR
                                        </td>
                                        <td>
                                            ${attestation.debt}
                                        </td>
                                        <td css={css`color: #dcfd8f; font-weight: 600;`}>
                                            {attestation.ratio}%
                                        </td>
                                        <td>
                                            <a
                                                href={`https://hashscan.io/${CONTRACTS.network}/topic/${CONTRACTS.hcsTopic}/messages`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                css={css`
                          color: #dcfd8f;
                          text-decoration: none;
                          font-family: monospace;
                          font-size: 0.875rem;
                          
                          &:hover {
                            text-decoration: underline;
                          }
                        `}
                                            >
                                                View on HCS
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} css={css`
                    text-align: center;
                    color: #a0a0a0;
                    padding: 2rem !important;
                  `}>
                                        No attestations available yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReservesPage;
