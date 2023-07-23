# Use the official Jekyll Docker image as the base image
FROM docker.io/jekyll/jekyll:latest

# Set the working directory inside the container
WORKDIR /site

# Copy the Jekyll files into the container
COPY . /site

# Create a new directory for the generated site with write permissions for the container user
RUN mkdir /site/_site && chown -R jekyll:jekyll /site/_site

# Install the Jekyll dependencies
RUN bundle install

# Expose the default Jekyll port (usually 4000)
EXPOSE 4000

# Set the default command to serve the Jekyll site
CMD ["jekyll", "serve", "--host", "0.0.0.0"]

