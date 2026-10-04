# Smart-home Hub Protocols for Echo Studio and Echo Dot Max

This note records the smart-home protocol capabilities that Amazon's public Alexa smart-home documentation lists for the two speaker models used in this project. It was compiled on October 4, 2026 from the primary sources linked below. Documentation lists change; re-check before publishing model-specific claims.

## Verified device lists

Amazon's Thread support page states that Thread-enabled Echo and eero devices have built-in Thread Border Routers supporting Thread 1.1 or 1.3, and lists the following relevant entries:

- Thread 1.3: **Echo Dot Max (2025 release)**, Echo Hub, Echo Plus (2nd Gen), Echo Show 11 (2025 release), Echo Show 10 (3rd Gen), Echo Show 8 (3rd Gen, 2025 release), **Echo Studio (1st Gen and newer, 2025 release)**, eero 6 and eero 6+, **eero 7**, eero Beacon, eero Max 7, eero Outdoor 7, eero PoE 6, eero PoE gateway, eero Pro, eero Pro 6E, eero Pro 6, and eero Pro 7.
- Thread 1.1: Echo (4th Gen).

Amazon's Matter support page lists the Matter-enabled devices and includes both **Echo Dot Max (2025 release)** and **Echo Studio (1st Gen and newer, 2025 release)**, plus the eero models listed above. It states that Alexa supports Matter over Wi-Fi and Matter over Thread, and that Bluetooth Low Energy is used during discovery and commissioning to pass network credentials.

Sources:

- <https://developer.amazon.com/docs/alexaplus/smarthome/thread-support.html>
- <https://developer.amazon.com/docs/alexaplus/smarthome/matter-support.html>

## What this means for the project

- Both speaker models can act as a **Thread Border Router**, so Matter-over-Thread accessories can join the home network through an Echo instead of a separate hub.
- Because **eero 7 and eero Max 7 are also listed as Thread Border Routers**, a combined Echo Studio + Echo Dot Max + eero 7 setup can provide more than one Thread Border Router in a home. That is a placement and coverage question, not a guarantee: Thread border routing still needs workable radio coverage between the router and the accessories.
- Protocol parity between the two models means the smart-home argument alone does not justify the price difference between them. The audio difference, and the supported speaker count for a given Fire TV, are the practical reasons to choose Echo Studio for a theater.

## Zigbee: not listed for either model

The project's earlier notes listed Zigbee as an Echo Studio smart-home capability. Amazon's current protocol documentation does not support that claim for these two models:

- Neither Echo Studio (1st Gen and newer, 2025 release) nor Echo Dot Max (2025 release) appears in the Matter or Thread Border Router device lists.
- Amazon's Zigbee help article, "Connect Zigbee Smart Home Devices to Alexa Using Your Echo with a Smart Home Hub", says to use the built-in hub in compatible Echo Family Devices and, when unsure, to ask Alexa "Do you have a smart home hub?". It does not name Echo Studio or Echo Dot Max.

Conclusion for the guide: describe Matter and Thread support for both models, and state that Zigbee needs a separate hub or bridge such as an Echo Hub. Do not claim either model is a Zigbee hub. Anyone who can confirm a different current answer from Amazon should update this note and the site together.

Zigbee help article: <https://www.amazon.com/gp/help/customer/display.html?nodeId=G8LQHC9R2S736XUQ> (retrieved through Amazon's help mirror; automated requests to the www.amazon.com form may be blocked).

## Relationship to other notes

- [Echo Studio, Wi-Fi Coverage, and Smart Home Hub](./echo-studio-wifi-smart-home.md) covers how the hub role relates to the theater and eero roles, and previously carried the Zigbee claim corrected here.
- [Extend an eero Mesh with Echo Speakers](./eero-built-in-echo-speakers.md) covers eero Built-in mesh extension, which is a separate feature from Thread Border Router support.
- [Alexa Home Theater setup](./alexa-home-theater-amazon-help.md) covers Fire TV compatibility and the supported speaker counts.
