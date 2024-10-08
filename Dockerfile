FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Display the contents of the src directory
#RUN echo "Contents of src directory:" && ls -la src

# Run the build step
RUN npm run build

# Display the contents of the dist directory
#RUN echo "Contents of dist directory:" && ls -la dist

EXPOSE 3000

# Use node to run the built application
CMD ["node", "dist/index.js"]