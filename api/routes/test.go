package routes

import "github.com/gofiber/fiber/v2"

func TestHandler(c *fiber.Ctx) error {
	return c.SendString("Hello from /api/test")
}
