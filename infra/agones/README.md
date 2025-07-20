# Utilizing Agones

Initially it seemed like a good idea to utilize the agones CRDs to allow for a simple connection, however due to wanting a browser based MMO in the browser, it would prove to be much more work to get a working implementation agones with real-time UDP responses being sent as agones by default sets it as a udp connection (although we can change the protocol to be TCP, i found this didn't resolve my issue of not being able to connect to the MMO website)

for now I'll leave this here as I intend to come back to this once I'm at the phase of having a list of multiple servers to choose from. I'd imagine having a stand alone game client would be prove to be easier but due to wanting this to be in the browser I'll need more time to investigate.
