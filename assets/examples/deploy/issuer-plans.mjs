import {hashes,isValidClassicAddress,validate,encode} from 'xahau';

export function issuerPlan({kind,issuer,holder,recipient,uri='ipfs://example-teaching-asset'}){
  for(const [name,address] of Object.entries({issuer,holder,...(kind==='token'?{recipient}:{})}))
    if(!isValidClassicAddress(address))throw new Error(`Invalid ${name} classic address`);
  if(issuer===holder||(kind==='token'&&(recipient===issuer||recipient===holder)))throw new Error('Use distinct issuer and holder accounts (and recipient for token)');
  let steps,alternatives,identity;
  const base=(TransactionType,Account,fields)=>({TransactionType,Account,NetworkID:21338,...fields});
  if(kind==='uritoken'){
    if(typeof uri!=='string'||!/^ipfs:\/\/[\x21-\x7e]+$/.test(uri)||Buffer.byteLength(uri)>200)throw new Error('Example URI must be printable ASCII ipfs:// with 1..193 payload bytes');
    const tokenId=hashes.hashURIToken(issuer,uri),URI=Buffer.from(uri).toString('hex').toUpperCase();
    identity={issuer,holder,URI,tokenId};
    steps=[
      {name:'mint',tx:base('URITokenMint',issuer,{URI,Flags:0}),readback:{owner:issuer,offer:false}},
      {name:'offer',tx:base('URITokenCreateSellOffer',issuer,{URITokenID:tokenId,Destination:holder,Amount:'1000000'}),readback:{owner:issuer,destination:holder,amount:'1000000'}},
      {name:'buy',tx:base('URITokenBuy',holder,{URITokenID:tokenId,Amount:'1000000'}),readback:{owner:holder,offer:false}},
      {name:'owner-burn',tx:base('URITokenBurn',holder,{URITokenID:tokenId}),readback:{absent:true}}
    ];
    alternatives=[{after:'offer',name:'cancel-instead-of-buy',tx:base('URITokenCancelSellOffer',issuer,{URITokenID:tokenId}),readback:{owner:issuer,offer:false}}];
  }else if(kind==='token'){
    const amount=value=>({currency:'TST',issuer,value});identity={issuer,holder,recipient,currency:'TST'};
    steps=[
      {name:'holder-trust',tx:base('TrustSet',holder,{LimitAmount:amount('1000'),Flags:0x00020000}),readback:{account:holder,balance:'0'}},
      {name:'recipient-trust',tx:base('TrustSet',recipient,{LimitAmount:amount('1000'),Flags:0x00020000}),readback:{account:recipient,balance:'0'}},
      {name:'issue',tx:base('Payment',issuer,{Destination:holder,Amount:amount('10'),Flags:0}),readback:{account:holder,balance:'10'}},
      {name:'transfer',tx:base('Payment',holder,{Destination:recipient,Amount:amount('2'),Flags:0}),readback:{account:recipient,balance:'2'}},
      {name:'redeem',tx:base('Payment',recipient,{Destination:issuer,Amount:amount('2'),Flags:0}),readback:{account:recipient,balance:'0'}}
    ];alternatives=[];
  }else throw new Error('kind must be uritoken or token');
  // Exercise the locked codec, using dummy common fields only for validation/round-trip.
  for(const {tx} of [...steps,...alternatives]){validate(tx);encode({...tx,Fee:'0',Sequence:1,LastLedgerSequence:100,SigningPubKey:''});}
  return {kind,networkId:21338,stage:'UNSIGNED_OFFLINE_PLAN',identity,steps,alternatives,
    warning:'Execute one authorized step at a time with readback. Alternative branches are not a batch. No signer, RPC, installation, emission or live certification is included.'};
}

function decimal(value){
  if(typeof value!=='string'||! /^-?\d+(?:\.\d+)?$/.test(value))throw new Error('Expected plain decimal string');
  let [whole,fraction='']=value.replace(/^-/,'').split('.');whole=whole.replace(/^0+(?=\d)/,'');fraction=fraction.replace(/0+$/,'');
  return (value.startsWith('-')&&(whole!=='0'||fraction)?'-':'')+whole+(fraction?'.'+fraction:'');
}
export function assertIssuerReadback(plan,stepName,snapshot,receipt){
  const step=[...plan.steps,...plan.alternatives].find(s=>s.name===stepName);
  if(!step)throw new Error('Unknown step');
  const tx=receipt?.tx_json??receipt?.transaction??receipt;
  if(receipt?.validated!==true||receipt.meta?.TransactionResult!=='tesSUCCESS'||!Number.isSafeInteger(receipt.ledger_index)||receipt.ledger_index<1)throw new Error('Expected validated successful receipt with ledger index');
  for(const [key,value] of Object.entries(step.tx))if(JSON.stringify(tx[key])!==JSON.stringify(value)){
    // Object key order is not semantically meaningful for issued Amounts.
    if(typeof value!=='object'||value===null||Object.keys(value).some(k=>tx[key]?.[k]!==value[k]))throw new Error(`Receipt does not match planned ${key}`);
  }
  if(snapshot?.networkId!==21338||snapshot.validated!==true||! /^[A-Fa-f0-9]{64}$/.test(snapshot.ledgerHash??'')||!Number.isSafeInteger(snapshot.ledgerIndex)||snapshot.ledgerIndex<receipt.ledger_index)throw new Error('Expected testnet snapshot at or after receipt ledger');
  const expected=step.readback;
  if(plan.kind==='uritoken'){
    if(snapshot.kind!=='uritoken'||snapshot.tokenId!==plan.identity.tokenId)throw new Error('Wrong URIToken snapshot');
    const node=snapshot.node;
    if(expected.absent){if(node!==null)throw new Error('URIToken still exists');return true;}
    if(node?.LedgerEntryType!=='URIToken'||node.index?.toUpperCase()!==plan.identity.tokenId.toUpperCase()||node.Issuer!==plan.identity.issuer||node.URI?.toUpperCase()!==plan.identity.URI||node.Owner!==expected.owner)throw new Error('URIToken identity/owner mismatch');
    if(expected.offer===false&&(node.Amount!==undefined||node.Destination!==undefined))throw new Error('Unexpected active offer');
    if(expected.amount!==undefined&&(node.Amount!==expected.amount||node.Destination!==expected.destination))throw new Error('Offer mismatch');
    if(!Number.isSafeInteger(node.Flags)||(node.Flags&1)!==0)throw new Error('Unexpected issuer burn authority');
  }else{
    if(snapshot.kind!=='token'||snapshot.account!==expected.account||snapshot.issuer!==plan.identity.issuer||snapshot.currency!=='TST')throw new Error('Wrong trust line snapshot');
    if(!snapshot.line||snapshot.line.account!==plan.identity.issuer||snapshot.line.currency!=='TST'||decimal(snapshot.line.balance)!==decimal(expected.balance))throw new Error('Trust line balance mismatch');
  }
  return true;
}
