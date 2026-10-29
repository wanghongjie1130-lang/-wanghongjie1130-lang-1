# Retailer source adapters

Retailer adapters require a documented API, affiliate feed, merchant feed, or explicit permission. A missing adapter must return `UNSUPPORTED_SOURCE`; the importer must not silently report zero products or bypass access controls.
