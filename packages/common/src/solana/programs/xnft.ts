import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import type { Provider } from "@project-serum/anchor";
import { metadata } from "@project-serum/token";
import { externalResourceUri } from "@coral-xyz/common-public";

export const XNFT_PROGRAM_ID = new PublicKey(
  "BaHSGaf883GA3u8qSC5wNigcXyaScJLSBJZbALWvPcjs"
);

export async function fetchXnfts(
  provider: Provider,
  wallet: PublicKey
): Promise<Array<{ publicKey: PublicKey; medtadata: any; metadataBlob: any }>> {
  const client = xnftClient(provider);

  //
  // Fetch all xnfts installed by this user.
  //
  const xnftInstalls = await client.account.install.all([
    {
      memcmp: {
        offset: 8, // Discriminator
        bytes: wallet.toString(),
      },
    },
  ]);

  //
  // Get the metadata accounts for all xnfts.
  //
  const metadataPubkeys = xnftInstalls.map(
    ({ account }) => account.masterMetadata
  );
  const xnftMetadata = (
    await anchor.utils.rpc.getMultipleAccounts(
      provider.connection,
      metadataPubkeys
    )
  ).map((t) => {
    if (!t) {
      return null;
    }
    return metadata.decodeMetadata(t.account.data);
  });

  //
  // Fetch the metadata uri blob.
  //
  const xnftMetadataBlob = await Promise.all(
    xnftMetadata.map((m) => {
      if (!m) {
        return null;
      }
      return fetch(externalResourceUri(m.data.uri)).then((r) => r.json());
    })
  );

  //
  // Combine it all into a single list.
  //
  const xnfts = [] as any;
  metadataPubkeys.forEach((metadataPublicKey, idx) => {
    xnfts.push({
      metadataPublicKey,
      metadata: xnftMetadata[idx],
      metadataBlob: xnftMetadataBlob[idx],
      install: xnftInstalls[idx],
    });
  });

  return xnfts;
}

export async function fetchXnft(
  provider: Provider,
  xnft: PublicKey
): Promise<{
  xnftAccount: any;
  metadataPublicKey: any;
  metadata: any;
  metadataBlob: any;
}> {
  const client = xnftClient(provider);
  const xnftAccount = await client.account.xnft.fetch(xnft);

  const metadataPublicKey = xnftAccount.masterMetadata;
  const xnftMetadata = await (async () => {
    const info = await provider.connection.getAccountInfo(metadataPublicKey);
    if (!info) {
      throw new Error("account info not found");
    }
    return metadata.decodeMetadata(info.data);
  })();

  const xnftMetadataBlob = await fetch(
    externalResourceUri(xnftMetadata.data.uri)
  ).then((r) => r.json());
  return {
    metadataPublicKey,
    metadata: xnftMetadata,
    metadataBlob: xnftMetadataBlob,
    xnftAccount,
  };
}

export function xnftClient(provider: Provider): Program<Xnft> {
  return new Program<Xnft>(IDL, XNFT_PROGRAM_ID, provider);
}

type Xnft = {
  version: "0.1.0";
  name: "xnft";
  constants: [
    {
      name: "MAX_NAME_LEN";
      type: {
        defined: "usize";
      };
      value: "30";
    },
    {
      name: "MAX_RATING";
      type: "u8";
      value: "5";
    }
  ];
  instructions: [
    {
      name: "createXnft";
      docs: [
        "Creates all parts of an xNFT instance.",
        "",
        "* Master mint (supply 1).",
        "* Master token.",
        "* Master metadata PDA associated with the master mint.",
        "* Master edition PDA associated with the master mint.",
        "* xNFT PDA associated with the master edition.",
        "",
        'Once this is invoked, an xNFT exists and can be "installed" by users.'
      ];
      accounts: [
        {
          name: "masterMint";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "mint";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "publisher";
              },
              {
                kind: "arg";
                type: "string";
                path: "name";
              }
            ];
          };
        },
        {
          name: "masterToken";
          isMut: true;
          isSigner: false;
        },
        {
          name: "masterMetadata";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "metadata";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "metadata_program";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Mint";
                path: "master_mint";
              }
            ];
            programId: {
              kind: "account";
              type: "publicKey";
              path: "metadata_program";
            };
          };
        },
        {
          name: "masterEdition";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "metadata";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "metadata_program";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Mint";
                path: "master_mint";
              },
              {
                kind: "const";
                type: "string";
                value: "edition";
              }
            ];
            programId: {
              kind: "account";
              type: "publicKey";
              path: "metadata_program";
            };
          };
        },
        {
          name: "xnft";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "xnft";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "master_edition";
              }
            ];
          };
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "publisher";
          isMut: false;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "metadataProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "name";
          type: "string";
        },
        {
          name: "params";
          type: {
            defined: "CreateXnftParams";
          };
        }
      ];
    },
    {
      name: "updateXnft";
      docs: [
        "Updates the code of an xNFT.",
        "",
        "This is simply a token metadata update cpi."
      ];
      accounts: [
        {
          name: "xnft";
          isMut: true;
          isSigner: false;
        },
        {
          name: "masterToken";
          isMut: false;
          isSigner: false;
        },
        {
          name: "masterMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "metadataProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "updates";
          type: {
            defined: "UpdateParams";
          };
        }
      ];
    },
    {
      name: "createReview";
      docs: [
        'Creates a "review" of an xNFT containing a URI to a comment and a 0-5 rating.'
      ];
      accounts: [
        {
          name: "install";
          isMut: false;
          isSigner: false;
        },
        {
          name: "masterToken";
          isMut: false;
          isSigner: false;
        },
        {
          name: "xnft";
          isMut: true;
          isSigner: false;
        },
        {
          name: "review";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "review";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Xnft";
                path: "xnft";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "author";
              }
            ];
          };
        },
        {
          name: "author";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "uri";
          type: "string";
        },
        {
          name: "rating";
          type: "u8";
        }
      ];
    },
    {
      name: "createInstall";
      docs: [
        'Creates an "installation" of an xNFT.',
        "",
        "Installation is just a synonym for minting an xNFT edition for a given",
        "user."
      ];
      accounts: [
        {
          name: "xnft";
          isMut: true;
          isSigner: false;
        },
        {
          name: "installVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "masterMetadata";
          isMut: false;
          isSigner: false;
        },
        {
          name: "install";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "install";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "authority";
              },
              {
                kind: "account";
                type: "publicKey";
                account: "Xnft";
                path: "xnft";
              }
            ];
          };
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "deleteInstall";
      docs: [
        "Variant of `create_xnft_installation` where the install authority is",
        "required to sign.",
        "Closes the install account."
      ];
      accounts: [
        {
          name: "install";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiver";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: "deleteReview";
      docs: [
        "Closes the review account and removes metrics from xNFT account."
      ];
      accounts: [
        {
          name: "review";
          isMut: true;
          isSigner: false;
        },
        {
          name: "xnft";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiver";
          isMut: true;
          isSigner: false;
        },
        {
          name: "author";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: "setSuspended";
      docs: ["Sets the install suspension flag on the xnft."];
      accounts: [
        {
          name: "xnft";
          isMut: true;
          isSigner: false;
        },
        {
          name: "masterToken";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "flag";
          type: "bool";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "xnft";
      type: {
        kind: "struct";
        fields: [
          {
            name: "publisher";
            docs: ["The pubkey of the original xNFT creator (32)."];
            type: "publicKey";
          },
          {
            name: "installVault";
            docs: [
              "The pubkey of the account to receive install payments (32)."
            ];
            type: "publicKey";
          },
          {
            name: "masterEdition";
            docs: ["The pubkey of the ML master edition account (32)."];
            type: "publicKey";
          },
          {
            name: "masterMetadata";
            docs: ["The pubkey of the MPL master metadata account (32)."];
            type: "publicKey";
          },
          {
            name: "masterMint";
            docs: ["The pubkey of the master token mint (32)."];
            type: "publicKey";
          },
          {
            name: "installAuthority";
            docs: [
              "The optional pubkey of the xNFT installation authority (33)."
            ];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "bump";
            docs: ["The bump nonce for the xNFT's PDA (1)."];
            type: "u8";
          },
          {
            name: "kind";
            docs: ["The `Kind` enum variant describing the type of xNFT (1)."];
            type: {
              defined: "Kind";
            };
          },
          {
            name: "tag";
            docs: [
              "The `Tag` enum variant to assign the category of xNFT (1)."
            ];
            type: {
              defined: "Tag";
            };
          },
          {
            name: "name";
            docs: ["The display name of the xNFT account (MAX_NAME_LEN)."];
            type: "string";
          },
          {
            name: "totalInstalls";
            docs: [
              "Total amount of install accounts that have been created for this xNFT (8)."
            ];
            type: "u64";
          },
          {
            name: "installPrice";
            docs: ["The price-per-install of this xNFT (8)."];
            type: "u64";
          },
          {
            name: "createdTs";
            docs: ["The unix timestamp of when the account was created (8)."];
            type: "i64";
          },
          {
            name: "updatedTs";
            docs: [
              "The unix timestamp of the last time the account was updated (8)."
            ];
            type: "i64";
          },
          {
            name: "suspended";
            docs: [
              "Flag to determine whether new installations of the xNFT should be halted (1)."
            ];
            type: "bool";
          },
          {
            name: "totalRating";
            docs: ["The total cumulative rating value of all reviews (8)."];
            type: "u64";
          },
          {
            name: "numRatings";
            docs: [
              "The number of ratings created used to calculate the average (4)."
            ];
            type: "u32";
          },
          {
            name: "l1";
            docs: [
              "The `L1` enum variant to designate the associated blockchain (1)."
            ];
            type: {
              defined: "L1";
            };
          },
          {
            name: "supply";
            docs: [
              "The optional finite supply of installations available for this xNFT (9)."
            ];
            type: {
              option: "u64";
            };
          },
          {
            name: "reserved";
            docs: ["Unused reserved byte space for additive future changes."];
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    },
    {
      name: "install";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            docs: ["The authority who created the installation (32)."];
            type: "publicKey";
          },
          {
            name: "xnft";
            docs: ["The pubkey of the xNFT that was installed (32)."];
            type: "publicKey";
          },
          {
            name: "masterMetadata";
            docs: ["The pubkey of the MPL master metadata account (32)."];
            type: "publicKey";
          },
          {
            name: "edition";
            docs: ["The sequential installation number of the xNFT (8)."];
            type: "u64";
          },
          {
            name: "reserved";
            docs: ["Unused reserved byte space for additive future changes."];
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    },
    {
      name: "review";
      type: {
        kind: "struct";
        fields: [
          {
            name: "author";
            docs: ["The pubkey of the account that created the review (32)."];
            type: "publicKey";
          },
          {
            name: "xnft";
            docs: ["The pubkey of the associated xNFT (32)."];
            type: "publicKey";
          },
          {
            name: "rating";
            docs: ["The numerical rating for the review, 0-5 (1)."];
            type: "u8";
          },
          {
            name: "uri";
            docs: [
              "The URI of the off-chain JSON data that holds the comment (4 + len)."
            ];
            type: "string";
          },
          {
            name: "reserved";
            docs: ["Unused reserved byte space for future additive changes."];
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "CreatorsParam";
      type: {
        kind: "struct";
        fields: [
          {
            name: "address";
            type: "publicKey";
          },
          {
            name: "share";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "CreateXnftParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "symbol";
            type: "string";
          },
          {
            name: "tag";
            type: {
              defined: "Tag";
            };
          },
          {
            name: "kind";
            type: {
              defined: "Kind";
            };
          },
          {
            name: "l1";
            type: {
              defined: "L1";
            };
          },
          {
            name: "uri";
            type: "string";
          },
          {
            name: "sellerFeeBasisPoints";
            type: "u16";
          },
          {
            name: "installPrice";
            type: "u64";
          },
          {
            name: "installVault";
            type: "publicKey";
          },
          {
            name: "supply";
            type: {
              option: "u64";
            };
          },
          {
            name: "collection";
            type: {
              option: "publicKey";
            };
          },
          {
            name: "creators";
            type: {
              vec: {
                defined: "CreatorsParam";
              };
            };
          }
        ];
      };
    },
    {
      name: "UpdateParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "installVault";
            type: {
              option: "publicKey";
            };
          },
          {
            name: "name";
            type: {
              option: "string";
            };
          },
          {
            name: "price";
            type: {
              option: "u64";
            };
          },
          {
            name: "tag";
            type: {
              option: {
                defined: "Tag";
              };
            };
          },
          {
            name: "uri";
            type: {
              option: "string";
            };
          }
        ];
      };
    },
    {
      name: "Kind";
      type: {
        kind: "enum";
        variants: [
          {
            name: "App";
          },
          {
            name: "Collection";
          }
        ];
      };
    },
    {
      name: "L1";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Solana";
          },
          {
            name: "Ethereum";
          }
        ];
      };
    },
    {
      name: "Tag";
      type: {
        kind: "enum";
        variants: [
          {
            name: "None";
          },
          {
            name: "Defi";
          },
          {
            name: "Game";
          },
          {
            name: "Nft";
          }
        ];
      };
    }
  ];
  events: [
    {
      name: "InstallationCreated";
      fields: [
        {
          name: "installer";
          type: "publicKey";
          index: false;
        },
        {
          name: "xnft";
          type: "publicKey";
          index: false;
        }
      ];
    },
    {
      name: "ReviewCreated";
      fields: [
        {
          name: "author";
          type: "publicKey";
          index: false;
        },
        {
          name: "rating";
          type: "u8";
          index: false;
        },
        {
          name: "xnft";
          type: "publicKey";
          index: false;
        }
      ];
    },
    {
      name: "XnftUpdated";
      fields: [
        {
          name: "metadataUri";
          type: "string";
          index: false;
        },
        {
          name: "xnft";
          type: "publicKey";
          index: false;
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "CannotReviewOwned";
      msg: "You cannot create a review for an xNFT that you currently own or published";
    },
    {
      code: 6001;
      name: "CollectionWithoutKind";
      msg: "A collection pubkey was provided without the collection Kind variant";
    },
    {
      code: 6002;
      name: "InstallAuthorityMismatch";
      msg: "The asserted authority did not match that of the Install account";
    },
    {
      code: 6003;
      name: "InstallExceedsSupply";
      msg: "The max supply has been reached for the xNFT.";
    },
    {
      code: 6004;
      name: "NameTooLong";
      msg: "The name provided for creating the xNFT exceeded the byte limit";
    },
    {
      code: 6005;
      name: "RatingOutOfBounds";
      msg: "The rating for a review must be between 0 and 5";
    },
    {
      code: 6006;
      name: "ReviewInstallMismatch";
      msg: "The installation provided for the review does not match the xNFT";
    },
    {
      code: 6007;
      name: "SuspendedInstallation";
      msg: "Attempting to install a currently suspended xNFT";
    }
  ];
};

const IDL: Xnft = {
  version: "0.1.0",
  name: "xnft",
  constants: [
    {
      name: "MAX_NAME_LEN",
      type: {
        defined: "usize",
      },
      value: "30",
    },
    {
      name: "MAX_RATING",
      type: "u8",
      value: "5",
    },
  ],
  instructions: [
    {
      name: "createXnft",
      docs: [
        "Creates all parts of an xNFT instance.",
        "",
        "* Master mint (supply 1).",
        "* Master token.",
        "* Master metadata PDA associated with the master mint.",
        "* Master edition PDA associated with the master mint.",
        "* xNFT PDA associated with the master edition.",
        "",
        'Once this is invoked, an xNFT exists and can be "installed" by users.',
      ],
      accounts: [
        {
          name: "masterMint",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "mint",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "publisher",
              },
              {
                kind: "arg",
                type: "string",
                path: "name",
              },
            ],
          },
        },
        {
          name: "masterToken",
          isMut: true,
          isSigner: false,
        },
        {
          name: "masterMetadata",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "metadata",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "metadata_program",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Mint",
                path: "master_mint",
              },
            ],
            programId: {
              kind: "account",
              type: "publicKey",
              path: "metadata_program",
            },
          },
        },
        {
          name: "masterEdition",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "metadata",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "metadata_program",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Mint",
                path: "master_mint",
              },
              {
                kind: "const",
                type: "string",
                value: "edition",
              },
            ],
            programId: {
              kind: "account",
              type: "publicKey",
              path: "metadata_program",
            },
          },
        },
        {
          name: "xnft",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "xnft",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "master_edition",
              },
            ],
          },
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "publisher",
          isMut: false,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "metadataProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "name",
          type: "string",
        },
        {
          name: "params",
          type: {
            defined: "CreateXnftParams",
          },
        },
      ],
    },
    {
      name: "updateXnft",
      docs: [
        "Updates the code of an xNFT.",
        "",
        "This is simply a token metadata update cpi.",
      ],
      accounts: [
        {
          name: "xnft",
          isMut: true,
          isSigner: false,
        },
        {
          name: "masterToken",
          isMut: false,
          isSigner: false,
        },
        {
          name: "masterMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "metadataProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "updates",
          type: {
            defined: "UpdateParams",
          },
        },
      ],
    },
    {
      name: "createReview",
      docs: [
        'Creates a "review" of an xNFT containing a URI to a comment and a 0-5 rating.',
      ],
      accounts: [
        {
          name: "install",
          isMut: false,
          isSigner: false,
        },
        {
          name: "masterToken",
          isMut: false,
          isSigner: false,
        },
        {
          name: "xnft",
          isMut: true,
          isSigner: false,
        },
        {
          name: "review",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "review",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Xnft",
                path: "xnft",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "author",
              },
            ],
          },
        },
        {
          name: "author",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "uri",
          type: "string",
        },
        {
          name: "rating",
          type: "u8",
        },
      ],
    },
    {
      name: "createInstall",
      docs: [
        'Creates an "installation" of an xNFT.',
        "",
        "Installation is just a synonym for minting an xNFT edition for a given",
        "user.",
      ],
      accounts: [
        {
          name: "xnft",
          isMut: true,
          isSigner: false,
        },
        {
          name: "installVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "masterMetadata",
          isMut: false,
          isSigner: false,
        },
        {
          name: "install",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "install",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "authority",
              },
              {
                kind: "account",
                type: "publicKey",
                account: "Xnft",
                path: "xnft",
              },
            ],
          },
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "deleteInstall",
      docs: [
        "Variant of `create_xnft_installation` where the install authority is",
        "required to sign.",
        "Closes the install account.",
      ],
      accounts: [
        {
          name: "install",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiver",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "deleteReview",
      docs: [
        "Closes the review account and removes metrics from xNFT account.",
      ],
      accounts: [
        {
          name: "review",
          isMut: true,
          isSigner: false,
        },
        {
          name: "xnft",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiver",
          isMut: true,
          isSigner: false,
        },
        {
          name: "author",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "setSuspended",
      docs: ["Sets the install suspension flag on the xnft."],
      accounts: [
        {
          name: "xnft",
          isMut: true,
          isSigner: false,
        },
        {
          name: "masterToken",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "flag",
          type: "bool",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "xnft",
      type: {
        kind: "struct",
        fields: [
          {
            name: "publisher",
            docs: ["The pubkey of the original xNFT creator (32)."],
            type: "publicKey",
          },
          {
            name: "installVault",
            docs: [
              "The pubkey of the account to receive install payments (32).",
            ],
            type: "publicKey",
          },
          {
            name: "masterEdition",
            docs: ["The pubkey of the ML master edition account (32)."],
            type: "publicKey",
          },
          {
            name: "masterMetadata",
            docs: ["The pubkey of the MPL master metadata account (32)."],
            type: "publicKey",
          },
          {
            name: "masterMint",
            docs: ["The pubkey of the master token mint (32)."],
            type: "publicKey",
          },
          {
            name: "installAuthority",
            docs: [
              "The optional pubkey of the xNFT installation authority (33).",
            ],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "bump",
            docs: ["The bump nonce for the xNFT's PDA (1)."],
            type: "u8",
          },
          {
            name: "kind",
            docs: ["The `Kind` enum variant describing the type of xNFT (1)."],
            type: {
              defined: "Kind",
            },
          },
          {
            name: "tag",
            docs: [
              "The `Tag` enum variant to assign the category of xNFT (1).",
            ],
            type: {
              defined: "Tag",
            },
          },
          {
            name: "name",
            docs: ["The display name of the xNFT account (MAX_NAME_LEN)."],
            type: "string",
          },
          {
            name: "totalInstalls",
            docs: [
              "Total amount of install accounts that have been created for this xNFT (8).",
            ],
            type: "u64",
          },
          {
            name: "installPrice",
            docs: ["The price-per-install of this xNFT (8)."],
            type: "u64",
          },
          {
            name: "createdTs",
            docs: ["The unix timestamp of when the account was created (8)."],
            type: "i64",
          },
          {
            name: "updatedTs",
            docs: [
              "The unix timestamp of the last time the account was updated (8).",
            ],
            type: "i64",
          },
          {
            name: "suspended",
            docs: [
              "Flag to determine whether new installations of the xNFT should be halted (1).",
            ],
            type: "bool",
          },
          {
            name: "totalRating",
            docs: ["The total cumulative rating value of all reviews (8)."],
            type: "u64",
          },
          {
            name: "numRatings",
            docs: [
              "The number of ratings created used to calculate the average (4).",
            ],
            type: "u32",
          },
          {
            name: "l1",
            docs: [
              "The `L1` enum variant to designate the associated blockchain (1).",
            ],
            type: {
              defined: "L1",
            },
          },
          {
            name: "supply",
            docs: [
              "The optional finite supply of installations available for this xNFT (9).",
            ],
            type: {
              option: "u64",
            },
          },
          {
            name: "reserved",
            docs: ["Unused reserved byte space for additive future changes."],
            type: {
              array: ["u8", 64],
            },
          },
        ],
      },
    },
    {
      name: "install",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            docs: ["The authority who created the installation (32)."],
            type: "publicKey",
          },
          {
            name: "xnft",
            docs: ["The pubkey of the xNFT that was installed (32)."],
            type: "publicKey",
          },
          {
            name: "masterMetadata",
            docs: ["The pubkey of the MPL master metadata account (32)."],
            type: "publicKey",
          },
          {
            name: "edition",
            docs: ["The sequential installation number of the xNFT (8)."],
            type: "u64",
          },
          {
            name: "reserved",
            docs: ["Unused reserved byte space for additive future changes."],
            type: {
              array: ["u8", 64],
            },
          },
        ],
      },
    },
    {
      name: "review",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author",
            docs: ["The pubkey of the account that created the review (32)."],
            type: "publicKey",
          },
          {
            name: "xnft",
            docs: ["The pubkey of the associated xNFT (32)."],
            type: "publicKey",
          },
          {
            name: "rating",
            docs: ["The numerical rating for the review, 0-5 (1)."],
            type: "u8",
          },
          {
            name: "uri",
            docs: [
              "The URI of the off-chain JSON data that holds the comment (4 + len).",
            ],
            type: "string",
          },
          {
            name: "reserved",
            docs: ["Unused reserved byte space for future additive changes."],
            type: {
              array: ["u8", 64],
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "CreatorsParam",
      type: {
        kind: "struct",
        fields: [
          {
            name: "address",
            type: "publicKey",
          },
          {
            name: "share",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "CreateXnftParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "symbol",
            type: "string",
          },
          {
            name: "tag",
            type: {
              defined: "Tag",
            },
          },
          {
            name: "kind",
            type: {
              defined: "Kind",
            },
          },
          {
            name: "l1",
            type: {
              defined: "L1",
            },
          },
          {
            name: "uri",
            type: "string",
          },
          {
            name: "sellerFeeBasisPoints",
            type: "u16",
          },
          {
            name: "installPrice",
            type: "u64",
          },
          {
            name: "installVault",
            type: "publicKey",
          },
          {
            name: "supply",
            type: {
              option: "u64",
            },
          },
          {
            name: "collection",
            type: {
              option: "publicKey",
            },
          },
          {
            name: "creators",
            type: {
              vec: {
                defined: "CreatorsParam",
              },
            },
          },
        ],
      },
    },
    {
      name: "UpdateParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "installVault",
            type: {
              option: "publicKey",
            },
          },
          {
            name: "name",
            type: {
              option: "string",
            },
          },
          {
            name: "price",
            type: {
              option: "u64",
            },
          },
          {
            name: "tag",
            type: {
              option: {
                defined: "Tag",
              },
            },
          },
          {
            name: "uri",
            type: {
              option: "string",
            },
          },
        ],
      },
    },
    {
      name: "Kind",
      type: {
        kind: "enum",
        variants: [
          {
            name: "App",
          },
          {
            name: "Collection",
          },
        ],
      },
    },
    {
      name: "L1",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Solana",
          },
          {
            name: "Ethereum",
          },
        ],
      },
    },
    {
      name: "Tag",
      type: {
        kind: "enum",
        variants: [
          {
            name: "None",
          },
          {
            name: "Defi",
          },
          {
            name: "Game",
          },
          {
            name: "Nft",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "InstallationCreated",
      fields: [
        {
          name: "installer",
          type: "publicKey",
          index: false,
        },
        {
          name: "xnft",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "ReviewCreated",
      fields: [
        {
          name: "author",
          type: "publicKey",
          index: false,
        },
        {
          name: "rating",
          type: "u8",
          index: false,
        },
        {
          name: "xnft",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "XnftUpdated",
      fields: [
        {
          name: "metadataUri",
          type: "string",
          index: false,
        },
        {
          name: "xnft",
          type: "publicKey",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "CannotReviewOwned",
      msg: "You cannot create a review for an xNFT that you currently own or published",
    },
    {
      code: 6001,
      name: "CollectionWithoutKind",
      msg: "A collection pubkey was provided without the collection Kind variant",
    },
    {
      code: 6002,
      name: "InstallAuthorityMismatch",
      msg: "The asserted authority did not match that of the Install account",
    },
    {
      code: 6003,
      name: "InstallExceedsSupply",
      msg: "The max supply has been reached for the xNFT.",
    },
    {
      code: 6004,
      name: "NameTooLong",
      msg: "The name provided for creating the xNFT exceeded the byte limit",
    },
    {
      code: 6005,
      name: "RatingOutOfBounds",
      msg: "The rating for a review must be between 0 and 5",
    },
    {
      code: 6006,
      name: "ReviewInstallMismatch",
      msg: "The installation provided for the review does not match the xNFT",
    },
    {
      code: 6007,
      name: "SuspendedInstallation",
      msg: "Attempting to install a currently suspended xNFT",
    },
  ],
};
