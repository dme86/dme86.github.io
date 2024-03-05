---
title: Write Your Own GPT based Telegram Assistent
layout: page
---
In this article, I will teach you how to write a GPT-based Telegram Bot in [Go](https://go.dev/) using OpenAI's API.
This bot is just an example of how easy it is to utilize GPT's API. There are way more things you can do besides a chat bot, but this should give you a good and simple overview to start with.

<!-- more -->

For simplicity, I'm using Telegram because they offer the strongest and most straightforward [API for generating bots](https://core.telegram.org/bots#how-do-i-create-a-bot) on their network.

Now, you will need an API key for GPT; refer to their [pricing](https://openai.com/pricing). Depending on the model you want to use, the prices will differ. GPT-4 is, of course, the most expensive one. I paid $5 for testing purposes, and so far, it has cost me $0.24.

![enter image description here](https://i.imgur.com/Yd8yFbd.png)

You can test your GPT prompts in their playground and finetune them before going live:

![enter image description here](https://i.imgur.com/hnH2npy.png)

The Go code you'll need for the Telegram Bot is short and simple.

The main loop continually listens for updates from the Telegram bot. For each update, it checks if it is a message and proceeds to process the user input.
Upon receiving a message from the user, the bot extracts the text input. This user input is then passed to the OpenAI GPT-4 model to generate a response.

After generating the response using GPT-4, the bot constructs a Telegram message with the generated content and sends it back to the user in the same chat, completing the conversational loop.
Environment variables for the Telegram and OpenAI tokens are used.


````go
package main

import (
	"context"
	"log"
	"os"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/sashabaranov/go-openai"
)

func main() {
	// Set up Telegram bot
	bot, err := tgbotapi.NewBotAPI(os.Getenv("TELEGRAM_APITOKEN"))
	if err != nil {
		log.Panic(err)
	}
	bot.Debug = true
	log.Printf("Authorized on account %s", bot.Self.UserName)

	// Set up OpenAI API
	openaiKey := os.Getenv("OPENAI_API_KEY") // Replace with your OpenAI API key
	client := openai.NewClient(openaiKey)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	for update := range updates {
		if update.Message == nil { // ignore any non-Message updates
			continue
		}

		// Get user input
		userInput := update.Message.Text

		// Use OpenAI API to generate response
		gptResponse, err := generateGPTResponse(client, userInput)
		if err != nil {
			log.Println("Error generating GPT response:", err)
			continue
		}

		// Create a new MessageConfig with GPT response
		msg := tgbotapi.NewMessage(update.Message.Chat.ID, gptResponse)

		if _, err := bot.Send(msg); err != nil {
			log.Panic(err)
		}
	}
}

// Function to generate GPT response using OpenAI API
func generateGPTResponse(client *openai.Client, userInput string) (string, error) {
	request := &openai.ChatCompletionRequest{
		Model: openai.GPT4,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: `You are a project manager, specialized in agile.`,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: userInput,
			},
		},
	}

	response, err := client.CreateChatCompletion(context.Background(), *request)
	if err != nil {
		return "", err
	}

	return response.Choices[0].Message.Content, nil
}
````

The Golang function, `generateGPTResponse`, utilizes the OpenAI GPT-4 model to generate responses. It constructs a request for chat completion, specifying the GPT-4 model and incorporating a system message defining a scenario, such as being a project manager specialized in agile (from my test in the playground). The user's input is included in the request, forming a dialogue structure for the OpenAI model to generate a context-aware response.

To run this code, simply paste it into a file called `main.go` and initialize a new module via `go mod init`.


When you run `go mod init` in a directory, it creates a new `go.mod` file in that directory, which serves as the module definition:
![enter image description here](https://i.imgur.com/Yq0d07j.png)

The `go mod tidy` command in Go ensures that the `go.mod` file accurately reflects the dependencies used in the project, removing any unnecessary or unused dependencies and updating the module's dependency graph:
![enter image description here](https://i.imgur.com/dHAO8MB.png)

Now you are able to run that code directly without compiling it via `go run main.go`.

The Bot is now up and running and is already answering service requests:
![enter image description here](https://i.imgur.com/r1wIOIZ.png)

## Conclusion

It was really easy, fast, and cheap to set up, test, and run this example. I think it could be really helpful in different scenarios like Slack or service desk applications. Perhaps it can help create better issues in Jira or serve as the 1st level in customer support (with further training).
