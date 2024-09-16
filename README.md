<h1 align="center">Star-Track </h1>

## 👋 hello

Star-Track is a user-friendly utility for tracking GitHub repository statistics. 

## 💻 install

- clone repositoryą

    ```bash
    git clone https://github.com/SkalskiP/star-track.git
    ```
  
- setup python environment and activate it [optional]

    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

- install required dependencies

    ```bash
    pip install -r requirements.txt
    ```

## ⚙️ execute

```bash
python -m startrack.app
```

## 🐳 Docker

To test the Docker solution locally, follow these steps:

1. **Build the Docker Image**

    ```bash
    docker build -t startrack:latest .
    ```

2. **Run the Docker Container**

    ```bash
    docker run --rm \
      -e GITHUB_TOKEN=your_github_token \
      -e INPUT_ORGANIZATIONS=org1,org2 \
      -e INPUT_REPOSITORIES=user1/repo1,user2/repo2 \
      -v $(pwd)/data:/app/data \
      startrack:latest
    ```

### Explanation:

- `--rm`: Automatically remove the container when it exits.
- `-e GITHUB_TOKEN=your_github_token`: Set the `GITHUB_TOKEN` environment variable.
- `-e INPUT_ORGANIZATIONS=org1,org2`: Set the `INPUT_ORGANIZATIONS` environment variable.
- `-e INPUT_REPOSITORIES=user1/repo1,user2/repo2`: Set the `INPUT_REPOSITORIES` environment variable.
- `-v $(pwd)/data:/app/data`: Mount the `data` directory from your current working directory to the `/app/data` directory in the container. This allows you to access the output CSV file on your host machine.
- `startrack:latest`: The name of the Docker image to run.

## 📝 Notes

- **Ensure GitHub Token Permissions**: Make sure your GitHub token has the necessary permissions to access the repositories you want to track.
- **Data Directory**: Ensure the `data` directory exists in your current working directory or Docker will create it for you.
- **Environment Variables**: Adjust the environment variables as needed to match your specific use case.

By following these steps, you can test your Docker solution locally and ensure that your GitHub Action will work as expected. If you encounter any issues or need further assistance, feel free to ask!
