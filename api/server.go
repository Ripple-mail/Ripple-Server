package api

import (
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"ripple-server/api/routes"
)

func StartAPIServer() {
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST",
		AllowHeaders: "Content-Type",
	}))

	app.Get("/api/test", routes.TestHandler)
	app.Get("/api/login", routes.LoginHandler)

	port := getEnv("PORT", "3001")
	go func() {
		for {
			updateFolderMetric()
			time.Sleep(10 * time.Second)
		}
	}()

	log.Printf("Server running at http://localhost:%s\n", port)
	log.Fatal(app.Listen(":" + port))
}

func getEnv(key string, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func updateFolderMetric() {

}
