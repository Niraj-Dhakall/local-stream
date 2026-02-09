# LocalStream

# Folders

* server:
    - where the websocket server lives
    main.go: The file that holds the code for the server 
        - my notes:
            - the server takes in a http request and has to be upgraded to a websocket request
            * this is done by the upgrader var

            - since we are handlering syncronous transferes we need a mutex or else we might overwrite as someone is trying to read or the other way around
            - this is for the two connections **streamer** and **viewer**


            handlerWebSocket function:
                - this function is where the actual data is being transfered. The function doesn't need to understand the data being passed it just passes raw bytes between two connections

* web
