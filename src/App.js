import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOY_BLOCK } from "./contract";

const BASE_SEPOLIA_CHAIN_ID = '0x14a34';

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [activeTab, setActiveTab] = useState('mint');
  const [contractOwner, setContractOwner] = useState(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [nftName, setNftName] = useState('');
  const [nftMetadata, setNftMetadata] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isMinting, setIsMinting] = useState(false);
  const [myNFTs, setMyNFTs] = useState([]);
  const [loadingMyNFTs, setLoadingMyNFTs] = useState(false);
  const [listTokenId, setListTokenId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [buyingTokenId, setBuyingTokenId] = useState(null);
  const [collectedFees, setCollectedFees] = useState(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const connectWallet = async () => {
    if (!window.ethereum) return alert('MetaMask is not installed.');
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      setWrongNetwork(chainId !== BASE_SEPOLIA_CHAIN_ID);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(contractInstance);
      const owner = await contractInstance.owner();
      setContractOwner(owner);
    } catch (err) {
      console.error('Connection error:', err);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setContract(null);
    setMyNFTs([]);
    setListings([]);
    setContractOwner(null);
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const reload = () => window.location.reload();
    window.ethereum.on('chainChanged', reload);
    window.ethereum.on('accountsChanged', reload);
    return () => {
      window.ethereum.removeListener('chainChanged', reload);
      window.ethereum.removeListener('accountsChanged', reload);
    };
  }, []);

  const getHeaders = (contentType) => {
    const jwt = process.env.REACT_APP_PINATA_JWT;
    const key = process.env.REACT_APP_PINATA_API_KEY;
    const secret = process.env.REACT_APP_PINATA_SECRET_API_KEY;
    const headers = { 'Content-Type': contentType };
    if (jwt) {
      headers.Authorization = 'Bearer ' + jwt;
    } else if (key && secret) {
      headers.pinata_api_key = key;
      headers.pinata_secret_api_key = secret;
    } else {
      throw new Error('Missing Pinata credentials in .env');
    }
    return headers;
  };

  const uploadToIPFS = async (file) => {
    if (!file) return null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, { headers: getHeaders('multipart/form-data') });
      return res.data.IpfsHash;
    } catch (err) {
      console.error('Image upload error:', err.response && err.response.data ? err.response.data : err.message);
      return null;
    }
  };

  const pinJSONToIPFS = async (name, description, external_url, CID) => {
    try {
      const body = JSON.stringify({ name, description, external_url, image: 'https://gateway.pinata.cloud/ipfs/' + CID });
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', { method: 'POST', headers: getHeaders('application/json'), body });
      const json = await res.json();
      return json.IpfsHash;
    } catch (err) {
      console.error('JSON pin error:', err);
      return null;
    }
  };

  const toDisplayUrl = (uri) => uri ? uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/') : uri;
  const handleMint = async (e) => {
    e.preventDefault();
    if (!contract) return alert('Contract not connected');
    if (!nftName || !nftMetadata || !imageFile) return alert('Fill all fields.');
    setIsMinting(true);
    try {
      const imageCid = await uploadToIPFS(imageFile);
      if (!imageCid) return alert('Image upload failed.');
      const metadataCID = await pinJSONToIPFS(nftName, nftMetadata, 'https://gateway.pinata.cloud/', imageCid);
      if (!metadataCID) return alert('Metadata upload failed.');
      const metadataUrl = 'https://gateway.pinata.cloud/ipfs/' + metadataCID;
      const tx = await contract.safeMint(metadataUrl);
      await tx.wait();
      alert('NFT minted successfully!');
      setNftName(''); setNftMetadata(''); setImageFile(null); setImagePreview(null);
    } catch (err) {
      console.error('Mint failed:', err);
      alert('Minting failed: ' + (err.reason || err.message));
    } finally {
      setIsMinting(false);
    }
  };

  const fetchMyNFTs = useCallback(async () => {
    if (!contract || !walletAddress) return;
    setLoadingMyNFTs(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const latestBlock = await provider.getBlockNumber();
      const CHUNK = 2000; // MetaMask RPC limit ~2000 blocks per eth_getLogs call
      const startBlock = CONTRACT_DEPLOY_BLOCK
        ? Math.max(CONTRACT_DEPLOY_BLOCK, latestBlock - 50000)
        : Math.max(0, latestBlock - 10000);
      const allEvents = [];
      for (let from = startBlock; from <= latestBlock; from += CHUNK) {
        const to = Math.min(from + CHUNK - 1, latestBlock);
        const chunk = await contract.queryFilter(contract.filters.NFTMinted(), from, to);
        allEvents.push(...chunk);
      }
      const events = allEvents;
      const myTokens = [];
      for (const event of events) {
        const tokenId = event.args.tokenId;
        const currentOwner = await contract.ownerOf(tokenId);
        if (currentOwner.toLowerCase() !== walletAddress.toLowerCase()) continue;
        const uri = await contract.tokenURI(tokenId);
        try {
          const res = await fetch(toDisplayUrl(uri));
          const metadata = await res.json();
          myTokens.push({ tokenId: tokenId.toString(), name: metadata.name, description: metadata.description, image: toDisplayUrl(metadata.image) });
        } catch (_e) {
          myTokens.push({ tokenId: tokenId.toString(), name: 'Token #' + tokenId.toString(), description: '', image: null });
        }
      }
      setMyNFTs(myTokens);
    } catch (err) {
      console.error('Fetch NFTs failed:', err);
    } finally {
      setLoadingMyNFTs(false);
    }
  }, [contract, walletAddress]);

  const fetchListings = useCallback(async () => {
    if (!contract) return;
    setLoadingListings(true);
    try {
      const [tokenIds, listingData] = await contract.getAllListings();
      const enriched = [];
      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i].toString();
        const { seller, price } = listingData[i];
        try {
          const uri = await contract.tokenURI(tokenId);
          const res = await fetch(toDisplayUrl(uri));
          const metadata = await res.json();
          enriched.push({ tokenId, seller, price: price.toString(), name: metadata.name, description: metadata.description, image: toDisplayUrl(metadata.image) });
        } catch (_e) {
          enriched.push({ tokenId, seller, price: price.toString(), name: 'Token #' + tokenId, description: '', image: null });
        }
      }
      setListings(enriched);
    } catch (err) {
      console.error('Fetch listings failed:', err);
    } finally {
      setLoadingListings(false);
    }
  }, [contract]);
  const handleList = async (e) => {
    e.preventDefault();
    if (!contract) return alert('Contract not connected');
    if (!listTokenId || !listPrice) return alert('Enter token ID and price.');
    setIsListing(true);
    try {
      const priceInWei = ethers.parseEther(listPrice);
      const approveTx = await contract.approve(CONTRACT_ADDRESS, listTokenId);
      await approveTx.wait();
      const listTx = await contract.listNFT(listTokenId, priceInWei);
      await listTx.wait();
      alert('NFT listed for sale!');
      setListTokenId(''); setListPrice('');
      fetchMyNFTs();
    } catch (err) {
      console.error('List failed:', err);
      alert('Listing failed: ' + (err.reason || err.message));
    } finally {
      setIsListing(false);
    }
  };

  const handleBuy = async (tokenId, price) => {
    if (!contract) return alert('Contract not connected');
    setBuyingTokenId(tokenId);
    try {
      const tx = await contract.buyNFT(tokenId, { value: price });
      await tx.wait();
      alert('NFT purchased successfully!');
      fetchListings();
    } catch (err) {
      console.error('Buy failed:', err);
      alert('Purchase failed: ' + (err.reason || err.message));
    } finally {
      setBuyingTokenId(null);
    }
  };

  const handleCancelListing = async (tokenId) => {
    if (!contract) return alert('Contract not connected');
    try {
      const tx = await contract.cancelListing(tokenId);
      await tx.wait();
      alert('Listing cancelled!');
      fetchListings();
    } catch (err) {
      console.error('Cancel failed:', err);
      alert('Cancel failed: ' + (err.reason || err.message));
    }
  };

  const fetchCollectedFees = useCallback(async () => {
    if (!contract) return;
    try {
      const fees = await contract.collectedFees();
      setCollectedFees(ethers.formatEther(fees));
    } catch (err) {
      console.error('Fetch fees failed:', err);
    }
  }, [contract]);

  const handleWithdrawFees = async () => {
    if (!contract) return;
    setIsWithdrawing(true);
    try {
      const tx = await contract.withdrawFees();
      await tx.wait();
      alert('Fees withdrawn successfully!');
      fetchCollectedFees();
    } catch (err) {
      console.error('Withdraw failed:', err);
      alert('Withdraw failed: ' + (err.reason || err.message));
    } finally {
      setIsWithdrawing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my-nfts') fetchMyNFTs();
    if (activeTab === 'marketplace') fetchListings();
    if (activeTab === 'admin') fetchCollectedFees();
  }, [activeTab, fetchMyNFTs, fetchListings, fetchCollectedFees]);

  const isAdmin = contractOwner && walletAddress && contractOwner.toLowerCase() === walletAddress.toLowerCase();
  return (
    <div className="app">
      <h1>NFT Marketplace</h1>
      {wrongNetwork && (
        <div className="network-warning">
          <strong>Wrong Network:</strong> Please switch MetaMask to Base Sepolia Testnet
        </div>
      )}
      {!walletAddress ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <div className="wallet-badge">
            <span>Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            <button className="secondary" onClick={disconnectWallet}>Disconnect</button>
          </div>
          <div className="tabs">
            {['mint', 'my-nfts', 'marketplace'].map((tab) => (
              <button
                key={tab}
                className={'tab' + (activeTab === tab ? ' active' : '')}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'mint' ? 'Mint NFT' : tab === 'my-nfts' ? 'My NFTs' : 'Marketplace'}
              </button>
            ))}
            {isAdmin && (
              <button
                className={'tab' + (activeTab === 'admin' ? ' active' : '')}
                onClick={() => setActiveTab('admin')}
              >
                Admin
              </button>
            )}
          </div>

          {activeTab === 'mint' && (
            <form onSubmit={handleMint} className="nft-form">
              <div>
                <label>NFT Name</label>
                <input type="text" placeholder="e.g. Cosmic Ape #1" value={nftName} onChange={(e) => setNftName(e.target.value)} />
              </div>
              <div>
                <label>Description</label>
                <textarea placeholder="Describe your NFT..." value={nftMetadata} onChange={(e) => setNftMetadata(e.target.value)} />
              </div>
              <div>
                <label>Image File</label>
                <input
                  type="file" accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
                {imagePreview && <img src={imagePreview} alt="preview" className="image-preview" />}
              </div>
              <button type="submit" disabled={isMinting}>{isMinting ? 'Minting...' : 'Mint NFT'}</button>
            </form>
          )}
          {activeTab === 'my-nfts' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>My NFTs</h2>
                <button className="secondary" onClick={fetchMyNFTs}>Refresh</button>
              </div>
              <form onSubmit={handleList} className="list-form">
                <h3>List an NFT for Sale</h3>
                <div className="list-inputs">
                  <input type="number" placeholder="Token ID" value={listTokenId} onChange={(e) => setListTokenId(e.target.value)} />
                  <input type="number" step="0.001" placeholder="Price in ETH" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
                  <button type="submit" disabled={isListing}>{isListing ? 'Listing...' : 'List for Sale'}</button>
                </div>
              </form>
              {loadingMyNFTs ? (
                <p className="status-msg">Loading your NFTs...</p>
              ) : myNFTs.length === 0 ? (
                <p className="status-msg">You do not own any NFTs yet. Mint one!</p>
              ) : (
                <div className="nft-grid">
                  {myNFTs.map((nft) => (
                    <div key={nft.tokenId} className="nft-card">
                      {nft.image ? <img src={nft.image} alt={nft.name} /> : <div className="no-image">No Image</div>}
                      <div className="nft-info">
                        <h4>{nft.name}</h4>
                        <p>{nft.description}</p>
                        <span className="token-id">Token #{nft.tokenId}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'marketplace' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>Marketplace</h2>
                <button className="secondary" onClick={fetchListings}>Refresh</button>
              </div>
              {loadingListings ? (
                <p className="status-msg">Loading listings...</p>
              ) : listings.length === 0 ? (
                <p className="status-msg">No NFTs listed for sale yet.</p>
              ) : (
                <div className="nft-grid">
                  {listings.map((listing) => (
                    <div key={listing.tokenId} className="nft-card">
                      {listing.image ? <img src={listing.image} alt={listing.name} /> : <div className="no-image">No Image</div>}
                      <div className="nft-info">
                        <h4>{listing.name}</h4>
                        <p>{listing.description}</p>
                        <span className="token-id">Token #{listing.tokenId}</span>
                        <span className="price">{ethers.formatEther(listing.price)} ETH</span>
                        <span className="seller">Seller: {listing.seller.slice(0,6)}...{listing.seller.slice(-4)}</span>
                      </div>
                      <div className="nft-actions">
                        {listing.seller.toLowerCase() === walletAddress.toLowerCase() ? (
                          <button className="secondary" onClick={() => handleCancelListing(listing.tokenId)}>Cancel Listing</button>
                        ) : (
                          <button
                            onClick={() => handleBuy(listing.tokenId, listing.price)}
                            disabled={buyingTokenId === listing.tokenId}
                          >
                            {buyingTokenId === listing.tokenId ? 'Buying...' : 'Buy for ' + ethers.formatEther(listing.price) + ' ETH'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <div className="tab-content">
              <h2>Admin Panel</h2>
              <div className="admin-card">
                <p>Collected Marketplace Fees</p>
                <h3>{collectedFees !== null ? collectedFees + ' ETH' : 'Loading...'}</h3>
                <button onClick={handleWithdrawFees} disabled={isWithdrawing}>
                  {isWithdrawing ? 'Withdrawing...' : 'Withdraw Fees'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;