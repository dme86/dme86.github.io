---
layout: page
title: Buy Me a Coffee
permalink: /coffee/
description: Support Daniel Meier's writing with a direct Bitcoin payment.
---

<div class="coffee-page">
  <p class="coffee-lede">
    If something here saved you time or taught you something useful, you can buy me a coffee with Bitcoin.
    Payments go directly to my self-custodied hardware wallet.
  </p>

  <div class="coffee-payment">
    <div class="coffee-qr">
      <img
        src="{{ '/public/images/bitcoin-coffee-qr.svg' | relative_url }}"
        alt="QR code for the Bitcoin payment address"
        width="512"
        height="512"
      >
    </div>

    <div class="coffee-details">
      <p class="coffee-suggestion">Suggested coffee: ~€2.40</p>

      <div class="coffee-address-block">
        <span class="coffee-address-label">BTC address</span>
        <div class="coffee-address-row">
          <code id="coffee-bitcoin-address">bc1qk9uv0t4eatatrqt2wk2vgwyejhp33puhc35qtg</code>
          <button class="coffee-copy-button" type="button" data-copy-bitcoin-address>Copy</button>
        </div>
        <span class="coffee-copy-status" role="status" aria-live="polite"></span>
      </div>

      <a class="coffee-send-button" href="bitcoin:bc1qk9uv0t4eatatrqt2wk2vgwyejhp33puhc35qtg">Send Bitcoin</a>
    </div>
  </div>

  <p class="coffee-instructions">
    You need a Bitcoin wallet. Scan the QR code or click <strong>Send Bitcoin</strong>, enter the amount, and confirm the payment in your wallet.
  </p>
</div>
