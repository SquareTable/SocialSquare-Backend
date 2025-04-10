const server = require('./server')

const port = process.env.PORT || 3000;

server.listen(port, (error) =>  {
    if (error) {
        throw error
    }
    
    console.log(`Server running on port ${port}`);
})