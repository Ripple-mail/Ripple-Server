package main

import (
	"ripple-server/api"
	//	"ripple-server/smtp"
)

func main() {
	//	if err := smtp.StartSMTPServer(); err != nil {
	//		panic(err)
	//	}

	api.StartAPIServer()
}
