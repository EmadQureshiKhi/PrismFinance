import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACTS } from "@/config/contracts";

interface ReserveData {
    totalCollateral: string;
    totalDebt: string;
    collateralRatio: string;
    healthStatus: "HEALTHY" | "WARNING" | "CRITICAL";
    lastAttestation: string;
    contractBalance: string;
    totalUsers: string;
}

interface AttestationMessage {
    timestamp: string;
    collateral: string;
    debt: string;
    ratio: string;
    txHash: string;
    blockNumber: number;
    type?: string;
    action?: string;
    message?: string;
    funding?: {
        amount: string;
    };
}

export const useReserves = () => {
    const { connection } = useWallet();
    const [reserveData, setReserveData] = useState<ReserveData | null>(null);
    const [attestations, setAttestations] = useState<AttestationMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchReserveData = useCallback(async () => {
        try {
            setError(null);

            // Always use public RPC for reading reserve data (no wallet needed)
            const providerToUse = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");

            console.log("🔍 Fetching reserve data from:", CONTRACTS.oracle);

            // Get contracts - Fetch from Vault where actual collateral is stored
            const vaultContract = new ethers.Contract(
                CONTRACTS.vault,
                [
                    "function userCollateral(address) view returns (uint256)",
                    "function totalMinted(string) view returns (uint256)"
                ],
                providerToUse
            );

            const reserveOracle = new ethers.Contract(
                CONTRACTS.oracle,
                [
                    "function getInfo() view returns (uint256 collateral, uint256 syntheticValue, uint256 ratio, bool healthy, uint256 lastAttestation)"
                ],
                providerToUse
            );

            const oracleContract = new ethers.Contract(
                CONTRACTS.priceOracle,
                [
                    "function getPrice(string memory symbol) view returns (uint256)"
                ],
                providerToUse
            );

            // Fetch data in parallel
            const [
                reserveInfo,
                hbarPrice,
                reserveOracleBalance
            ] = await Promise.all([
                reserveOracle.getInfo().catch(() => [BigInt(0), BigInt(0), BigInt(0), false, BigInt(0)]),
                oracleContract.getPrice("HBAR").catch(() => BigInt(18000000)), // Fallback to ~$0.18
                providerToUse.getBalance(CONTRACTS.oracle)
            ]);

            const [reserveCollateral, totalDebt, globalRatio, healthy, lastUpdate] = reserveInfo;

            // Use actual contract balance only (no dummy data)
            const totalCollateral = reserveOracleBalance;

            console.log("💰 Total collateral:", {
                contractBalance: ethers.formatEther(reserveOracleBalance)
            });

            console.log("📊 Reserve data received:", {
                totalCollateral: ethers.formatEther(totalCollateral),
                totalDebt: Number(totalDebt) / 1e8,
                globalRatio: globalRatio.toString(),
                lastUpdate: Number(lastUpdate)
            });

            // Calculate collateral ratio properly using total HBAR
            let collateralRatio = "∞";
            let healthStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";

            if (totalDebt > 0) {
                // totalCollateral is in wei (18 decimals), convert to HBAR
                const totalHBAR = Number(ethers.formatEther(totalCollateral));

                // totalDebt is in USD cents (8 decimals), convert to USD
                const debtUSD = Number(totalDebt) / 1e8;

                // hbarPrice is in USD cents (8 decimals), convert to USD
                const hbarPriceUSD = Number(hbarPrice) / 1e8;

                // Calculate collateral value in USD
                const collateralValueUSD = totalHBAR * hbarPriceUSD;

                // Calculate ratio (collateral / debt)
                const ratio = collateralValueUSD / debtUSD;
                collateralRatio = (ratio * 100).toFixed(1);

                console.log("📊 Ratio calculation:", {
                    totalHBAR,
                    debtUSD,
                    hbarPriceUSD,
                    collateralValueUSD,
                    ratio: ratio * 100
                });

                if (ratio < 1.3) {
                    healthStatus = "CRITICAL";
                } else if (ratio < 1.5) {
                    healthStatus = "WARNING";
                }
            }

            // Format the data
            const formattedData: ReserveData = {
                totalCollateral: parseFloat(ethers.formatEther(totalCollateral)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }),
                totalDebt: (Number(totalDebt) / 1e8).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }),
                collateralRatio,
                healthStatus,
                lastAttestation: lastUpdate > 0 ? new Date(Number(lastUpdate) * 1000).toISOString() : new Date().toISOString(),
                contractBalance: parseFloat(ethers.formatEther(reserveOracleBalance)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }),
                totalUsers: "N/A" // Not available from reserve oracle
            };

            setReserveData(formattedData);
            setLastRefresh(new Date());

        } catch (err) {
            console.error("Error fetching reserve data:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch reserve data");
        } finally {
            setIsLoading(false);
        }
    }, [connection]);

    const fetchAttestations = useCallback(async () => {
        try {
            // Fetch from Hedera Mirror Node API - fetch more to account for broken messages
            const topicId = CONTRACTS.hcsTopic;
            const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=20&order=desc`;

            console.log("🔍 Fetching attestations from HCS topic:", topicId);

            const response = await fetch(mirrorNodeUrl);
            const data = await response.json();

            let realAttestations: AttestationMessage[] = [];

            if (data.messages && data.messages.length > 0) {
                realAttestations = data.messages.map((msg: any) => {
                    try {
                        // Decode base64 message
                        const messageText = atob(msg.message);
                        
                        // Skip messages that are clearly truncated (end with incomplete JSON)
                        if (messageText.length >= 1024 && !messageText.trim().endsWith('}')) {
                            // Message is truncated, skip it silently
                            return null;
                        }
                        
                        // Try to parse JSON - handle both single-line and pretty-printed
                        let attestation;
                        try {
                            attestation = JSON.parse(messageText);
                        } catch (parseError) {
                            // Silently skip unparseable messages
                            return null;
                        }

                        // Parse consensus timestamp (format: seconds.nanoseconds)
                        const [seconds] = msg.consensus_timestamp.split('.');
                        const timestamp = new Date(Number(seconds) * 1000);

                        // Handle different attestation formats
                        let collateralFromMsg = 0;
                        let debtFromMsg = 0;
                        let fundingAmount = 0;

                        // Check attestation type
                        if (attestation.type === "initialization") {
                            // Initialization message - skip or show as info
                            return {
                                timestamp: timestamp.toISOString(),
                                collateral: "0.00",
                                debt: "0.00",
                                ratio: "N/A",
                                txHash: "System Init",
                                blockNumber: msg.sequence_number,
                                rawCollateral: 0,
                                rawDebt: 0,
                                type: "initialization",
                                action: "System initialized",
                                message: attestation.message
                            };
                        } else if (attestation.type === "vault_reserves") {
                            // Vault reserves attestation (compact format)
                            collateralFromMsg = parseFloat(attestation.collateral || "0");
                            debtFromMsg = parseFloat(attestation.debt || "0");
                        } else if (attestation.type === "reserve_funding") {
                            // Compact format (new)
                            if (attestation.after !== undefined) {
                                collateralFromMsg = parseFloat(attestation.after || "0");
                                fundingAmount = parseFloat(attestation.add || "0");
                            } 
                            // Legacy verbose format (old)
                            else if (attestation.reserves?.after?.totalHBAR) {
                                collateralFromMsg = parseFloat(attestation.reserves.after.totalHBAR || "0");
                                fundingAmount = parseFloat(attestation.funding?.amountHBAR || attestation.funding?.amount || "0");
                            }
                            // For asset exchange, debt is 0 (no synthetic debt)
                            debtFromMsg = 0;
                        } else {
                            // Legacy vault format or other types
                            collateralFromMsg = parseFloat(attestation.reserves?.collateral?.hbar || "0");
                            debtFromMsg = parseFloat(attestation.reserves?.syntheticValue?.hbar || "0");
                        }

                        return {
                            timestamp: timestamp.toISOString(),
                            collateral: collateralFromMsg.toFixed(2),
                            debt: debtFromMsg.toFixed(2),
                            ratio: "0", // Will calculate later with cumulative
                            txHash: attestation.tx || `HCS Message #${msg.sequence_number}`,
                            blockNumber: attestation.block || msg.sequence_number,
                            rawCollateral: collateralFromMsg,
                            rawDebt: debtFromMsg,
                            type: attestation.type || "unknown",
                            action: attestation.action,
                            funding: fundingAmount > 0 ? {
                                amount: fundingAmount.toFixed(2)
                            } : undefined
                        };
                    } catch (e) {
                        console.error("Error parsing attestation:", e);
                        return null;
                    }
                }).filter((a: any) => a !== null);

                console.log("✅ Loaded", realAttestations.length, "real attestations from HCS");
            }

            // Use only real attestations (no dummy data)
            const allAttestations = realAttestations.slice(0, 10); // Show up to 10 latest

            // Calculate ratios for real attestations
            const hbarPrice = 0.18; // Approximate HBAR price

            for (const att of allAttestations as any[]) {
                const collateral = att.rawCollateral || parseFloat(att.collateral.replace(/,/g, ''));
                const debt = att.rawDebt || parseFloat(att.debt);

                if (debt > 0) {
                    const collateralValueUSD = collateral * hbarPrice;
                    const ratioValue = (collateralValueUSD / debt) * 100;
                    att.ratio = ratioValue.toFixed(1);
                } else {
                    // For asset exchange (no debt), show N/A instead of infinity
                    att.ratio = att.type === "reserve_funding" ? "N/A" : "∞";
                }

                // Format collateral display
                att.collateral = collateral.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                
                // Format debt display
                att.debt = debt.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }

            setAttestations(allAttestations);

        } catch (err) {
            console.error("Error fetching attestations:", err);
            // No fallback dummy data - just show empty
            setAttestations([]);
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([
            fetchReserveData(),
            fetchAttestations()
        ]);
    }, [fetchReserveData, fetchAttestations]);

    useEffect(() => {
        fetchReserveData();
        fetchAttestations();
    }, [fetchReserveData, fetchAttestations]);

    return {
        reserveData,
        attestations,
        isLoading,
        error,
        lastRefresh,
        refresh
    };
};
