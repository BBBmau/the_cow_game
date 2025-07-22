variable "project_id" {
  type        = string
  description = "The project ID to host the cluster in."
}

variable "region" {
  type        = string
  description = "The region to host the cluster in."
}

variable "image_sha" {
  type        = string
  description = "The SHA of the image to deploy."
}
